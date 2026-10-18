const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { 
  CANONICAL_ASSET_CLASSES, 
  normalizeAssetValuesMap, 
  normalizeHoldingsMap,
  settleRoundValuation 
} = require('../services/valuationService');

const CONFIG_DOC_ID = 'config';
const SIMULATION_COLLECTION = 'simulation';

// Valid simulation states
const SIMULATION_STATES = {
  SETUP: 'SETUP',
  INITIAL_ALLOCATION_OPEN: 'INITIAL_ALLOCATION_OPEN',
  ROUND_PREPARATION: 'ROUND_PREPARATION',
  REALLOCATION_OPEN: 'REALLOCATION_OPEN',
  REALLOCATION_CLOSED: 'REALLOCATION_CLOSED',
  RESULTS_PUBLISHED: 'RESULTS_PUBLISHED',
  FINISHED: 'FINISHED'
};

// Default config
const DEFAULT_CONFIG = {
  startingCapital: 1000000,
  totalRounds: 20,
  allocationWindowSeconds: 120,
  currentRound: 0,
  status: SIMULATION_STATES.SETUP
};

// Ensure config exists helper
const ensureConfigExists = async (t) => {
  const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
  const configDoc = t ? await t.get(configRef) : await configRef.get();
  
  if (!configDoc.exists) {
    if (t) {
      t.set(configRef, {
        ...DEFAULT_CONFIG,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      await configRef.set({
        ...DEFAULT_CONFIG,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    return DEFAULT_CONFIG;
  }
  return configDoc.data();
};

// Helper to fetch and validate all 7 asset values for a round
const getAndValidateRoundAssetValues = async (t, round) => {
  const assetRef = db.collection('assetValues').where('round', '==', round);
  const assetDocs = t ? await t.get(assetRef) : await assetRef.get();
  const rawValues = {};
  
  assetDocs.forEach(doc => {
    const data = doc.data();
    rawValues[data.assetClassId] = data.value;
  });

  const assetValues = normalizeAssetValuesMap(rawValues);

  const missingClasses = [];
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (assetValues[ac] === undefined || assetValues[ac] === null || !Number.isFinite(assetValues[ac])) {
      missingClasses.push(ac);
    }
  }

  if (missingClasses.length > 0) {
    const error = new Error(`Asset values are incomplete for round ${round}. Missing classes: ${missingClasses.join(', ')}`);
    error.statusCode = 409;
    error.missingClasses = missingClasses;
    throw error;
  }

  return assetValues;
};

// Helper: Initialize portfolios from Round 0 allocations
const runPortfolioInitialization = async (t, configRef) => {
  const teamsSnapshot = await (t ? t.get(db.collection('teams')) : db.collection('teams').get());
  const allocationsSnapshot = await (t ? t.get(db.collection('allocations').where('round', '==', 0)) : db.collection('allocations').where('round', '==', 0).get());
  
  const allocationsByTeam = {};
  allocationsSnapshot.forEach(doc => {
    const data = doc.data();
    allocationsByTeam[data.teamId] = data;
  });

  const now = new Date().toISOString();

  // Process all teams
  teamsSnapshot.forEach(teamDoc => {
    const teamId = teamDoc.id;
    const allocation = allocationsByTeam[teamId];
    const isSubmitted = allocation && allocation.status === 'SUBMITTED';

    let holdings = {};
    CANONICAL_ASSET_CLASSES.forEach(ac => { holdings[ac] = 0; });
    let totalInvested = 0;
    let cash = 1000000;

    if (isSubmitted && allocation.allocations) {
      holdings = normalizeHoldingsMap(allocation.allocations);
      totalInvested = allocation.allocatedAmount || 0;
      cash = 1000000 - totalInvested;
    }

    const portfolioRef = db.collection('portfolios').doc(`team_${teamId}`);
    const snapshotRef = db.collection('portfolioSnapshots').doc(`team_${teamId}_round_0`);

    const portfolioData = {
      id: `team_${teamId}`,
      teamId,
      currentRound: 0,
      holdings,
      totalInvested,
      cash,
      totalPortfolioValue: 1000000,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    const snapshotData = {
      id: `team_${teamId}_round_0`,
      teamId,
      round: 0,
      holdings,
      cash,
      investedValue: totalInvested,
      totalPortfolioValue: 1000000,
      profitLoss: 0,
      returnPercentage: 0,
      createdAt: now
    };

    if (t) {
      t.set(portfolioRef, portfolioData, { merge: true });
      t.set(snapshotRef, snapshotData, { merge: true });
    }
  });

  // Advance to Round 1, status ROUND_PREPARATION
  if (t) {
    t.update(configRef, {
      currentRound: 1,
      status: SIMULATION_STATES.ROUND_PREPARATION,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
};

// GET /api/admin/simulation
router.get('/', async (req, res) => {
  try {
    const config = await ensureConfigExists();
    return res.json({
      startingCapital: config.startingCapital,
      totalRounds: config.totalRounds,
      allocationWindowSeconds: config.allocationWindowSeconds,
      currentRound: config.currentRound,
      status: config.status
    });
  } catch (error) {
    console.error('Error fetching simulation state:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/start-initial-allocation (and alias /start-allocation)
const handleStartInitialAllocation = async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.currentRound !== 0 || config.status !== SIMULATION_STATES.SETUP) {
        throw new Error('INVALID_STATE');
      }
      
      t.update(configRef, {
        status: SIMULATION_STATES.INITIAL_ALLOCATION_OPEN,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Initial allocation opened successfully', status: SIMULATION_STATES.INITIAL_ALLOCATION_OPEN });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Initial allocation can only be started from SETUP state at Round 0.' });
    }
    console.error('Error starting initial allocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/start-initial-allocation', handleStartInitialAllocation);
router.post('/start-allocation', handleStartInitialAllocation);

// POST /api/admin/simulation/initialize-portfolios (and alias /start-round-1)
const handleInitializePortfolios = async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      // Allow from INITIAL_ALLOCATION_OPEN (or legacy ALLOCATION) at Round 0
      if (config.currentRound !== 0 || (config.status !== SIMULATION_STATES.INITIAL_ALLOCATION_OPEN && config.status !== 'ALLOCATION')) {
        throw new Error('INVALID_STATE');
      }
      
      await runPortfolioInitialization(t, configRef);
    });
    
    return res.json({ 
      message: 'Portfolios initialized successfully. Round 1 begins in ROUND_PREPARATION.', 
      currentRound: 1, 
      status: SIMULATION_STATES.ROUND_PREPARATION 
    });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Portfolios can only be initialized during INITIAL_ALLOCATION_OPEN at Round 0.' });
    }
    console.error('Error initializing portfolios:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/initialize-portfolios', handleInitializePortfolios);
router.post('/start-round-1', handleInitializePortfolios);

// POST /api/admin/simulation/publish-news-and-open-reallocation
router.post('/publish-news-and-open-reallocation', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      // Must be in ROUND_PREPARATION (or legacy NEWS_PUBLISHED)
      if (
        (config.status !== SIMULATION_STATES.ROUND_PREPARATION && config.status !== 'NEWS_PUBLISHED') || 
        config.currentRound < 1 || 
        config.currentRound > config.totalRounds
      ) {
        throw new Error('INVALID_STATE');
      }
      
      const currentRound = config.currentRound;

      // 1. Validate all seven Round N asset values exist (409 if missing)
      await getAndValidateRoundAssetValues(t, currentRound);

      // 2. Require at least one draft news item for Round N
      const newsQuery = db.collection('news').where('round', '==', currentRound);
      const newsSnapshot = await t.get(newsQuery);
      
      const draftNewsDocs = [];
      newsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'DRAFT') {
          draftNewsDocs.push(doc);
        }
      });

      if (draftNewsDocs.length === 0) {
        const err = new Error(`Cannot open reallocation: At least one draft news bulletin is required for Round ${currentRound}.`);
        err.statusCode = 409;
        throw err;
      }

      // 3. Atomically publish current-round draft news
      draftNewsDocs.forEach(doc => {
        t.update(doc.ref, {
          status: 'PUBLISHED',
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      // 4. Set simulation state to REALLOCATION_OPEN
      t.update(configRef, {
        status: SIMULATION_STATES.REALLOCATION_OPEN,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ 
      message: 'Round news published and reallocation opened successfully.',
      status: SIMULATION_STATES.REALLOCATION_OPEN 
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Reallocation can only be opened when simulation is in ROUND_PREPARATION state.' });
    }
    console.error('Error in publish-news-and-open-reallocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/close-reallocation
router.post('/close-reallocation', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.status !== SIMULATION_STATES.REALLOCATION_OPEN) {
        throw new Error('INVALID_STATE');
      }
      
      t.update(configRef, {
        status: SIMULATION_STATES.REALLOCATION_CLOSED,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ 
      message: 'Reallocation closed successfully.',
      status: SIMULATION_STATES.REALLOCATION_CLOSED 
    });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Reallocation can only be closed when in REALLOCATION_OPEN state.' });
    }
    console.error('Error closing reallocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/evaluate-round
router.post('/evaluate-round', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.status !== SIMULATION_STATES.REALLOCATION_CLOSED || config.currentRound < 1 || config.currentRound > config.totalRounds) {
        throw new Error('INVALID_STATE');
      }
      
      const concludingRound = config.currentRound;

      // 1. Verify all 7 asset values exist for concluding round (409 if missing)
      const assetValues = await getAndValidateRoundAssetValues(t, concludingRound);

      // 2. Read all active portfolios
      const portfoliosDocs = await t.get(db.collection('portfolios').where('status', '==', 'ACTIVE'));

      // 3. Read all submitted allocations for concludingRound
      const allocationsDocs = await t.get(db.collection('allocations').where('round', '==', concludingRound));
      const allocationsByTeam = {};
      allocationsDocs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'SUBMITTED') {
          allocationsByTeam[data.teamId] = data;
        }
      });

      // 4. Phase 1 (READS): Check which teams already have snapshots
      const existingSnapsByTeam = {};
      for (const portfolioDoc of portfoliosDocs.docs) {
        const portfolio = portfolioDoc.data();
        const teamId = portfolio.teamId || portfolioDoc.id.replace('team_', '');
        const snapshotRef = db.collection('portfolioSnapshots').doc(`team_${teamId}_round_${concludingRound}`);
        const existingSnap = await t.get(snapshotRef);
        existingSnapsByTeam[teamId] = existingSnap.exists;
      }

      // 5. Phase 2 (WRITES): Settle each active team's portfolio (idempotent snapshot handling)
      for (const portfolioDoc of portfoliosDocs.docs) {
        const portfolio = portfolioDoc.data();
        const teamId = portfolio.teamId || portfolioDoc.id.replace('team_', '');
        const snapshotRef = db.collection('portfolioSnapshots').doc(`team_${teamId}_round_${concludingRound}`);
        const snapshotExists = existingSnapsByTeam[teamId];

        let allocationToSettle;
        const submittedAllocation = allocationsByTeam[teamId];

        if (submittedAllocation && submittedAllocation.allocations) {
          allocationToSettle = {
            holdings: normalizeHoldingsMap(submittedAllocation.allocations),
            cash: typeof submittedAllocation.cash === 'number' 
              ? submittedAllocation.cash 
              : (submittedAllocation.unallocatedAmount || 0)
          };
        } else {
          // Rule: If a team does not submit for a round, retain its existing portfolio allocation
          allocationToSettle = {
            holdings: normalizeHoldingsMap(portfolio.holdings),
            cash: typeof portfolio.cash === 'number' ? portfolio.cash : 0
          };
        }

        // Calculate settlement using temporary financial settlement model in valuationService
        const settlement = settleRoundValuation(teamId, concludingRound, allocationToSettle, assetValues);

        // Do not overwrite existing snapshots (preserves idempotency and historical data)
        if (!snapshotExists) {
          t.set(snapshotRef, {
            id: `team_${teamId}_round_${concludingRound}`,
            teamId,
            round: concludingRound,
            holdings: settlement.settledHoldings,
            cash: settlement.cash,
            investedValue: settlement.totalInvestedValue,
            totalPortfolioValue: settlement.totalPortfolioValue,
            profitLoss: settlement.profitLoss,
            returnPercentage: settlement.percentageReturn,
            createdAt: FieldValue.serverTimestamp()
          });
        }

        // Update active portfolio with settled values as available capital for next round
        t.update(portfolioDoc.ref, {
          currentRound: concludingRound,
          holdings: settlement.settledHoldings,
          totalInvested: settlement.totalInvestedValue,
          cash: settlement.cash,
          totalPortfolioValue: settlement.totalPortfolioValue,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // 5. Transition state to RESULTS_PUBLISHED
      t.update(configRef, {
        status: SIMULATION_STATES.RESULTS_PUBLISHED,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ 
      message: 'Round evaluated and results published successfully.',
      status: SIMULATION_STATES.RESULTS_PUBLISHED 
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Round can only be evaluated when in REALLOCATION_CLOSED state.' });
    }
    console.error('Error evaluating round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/start-next-round
router.post('/start-next-round', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.status !== SIMULATION_STATES.RESULTS_PUBLISHED || config.currentRound >= config.totalRounds) {
        throw new Error('INVALID_STATE');
      }
      
      t.update(configRef, {
        currentRound: config.currentRound + 1,
        status: SIMULATION_STATES.ROUND_PREPARATION,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ 
      message: 'Next round preparation started successfully.',
      status: SIMULATION_STATES.ROUND_PREPARATION 
    });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Next round can only be started from RESULTS_PUBLISHED state for rounds 1 to 19.' });
    }
    console.error('Error starting next round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/finish
router.post('/finish', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      // Finishing is allowed ONLY when Round 20 results are published
      if (config.currentRound !== config.totalRounds || (config.status !== SIMULATION_STATES.RESULTS_PUBLISHED && config.status !== 'RUNNING')) {
        throw new Error('INVALID_STATE');
      }

      // Ensure Round 20 snapshots exist
      const r20Snapshots = await t.get(db.collection('portfolioSnapshots').where('round', '==', config.totalRounds));
      if (r20Snapshots.empty) {
        throw new Error('ROUND_20_NOT_EVALUATED');
      }

      t.update(configRef, {
        status: SIMULATION_STATES.FINISHED,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Simulation finished successfully. Final leaderboard is now available.', status: SIMULATION_STATES.FINISHED });
  } catch (error) {
    if (error.message === 'INVALID_STATE' || error.message === 'ROUND_20_NOT_EVALUATED') {
      return res.status(409).json({ error: 'Simulation cannot be finished until Round 20 results are evaluated and published.' });
    }
    console.error('Error finishing simulation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/reset
router.post('/reset', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      await ensureConfigExists(t);
      
      t.update(configRef, {
        currentRound: 0,
        status: SIMULATION_STATES.SETUP,
        startingCapital: 1000000,
        totalRounds: 20,
        allocationWindowSeconds: 120,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Simulation reset to SETUP successfully' });
  } catch (error) {
    console.error('Error resetting simulation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
