const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

const CONFIG_DOC_ID = 'config';
const SIMULATION_COLLECTION = 'simulation';

// Default config
const DEFAULT_CONFIG = {
  startingCapital: 1000000,
  totalRounds: 20,
  allocationWindowSeconds: 120,
  currentRound: 0,
  status: "SETUP"
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

// POST /api/admin/simulation/start-allocation
router.post('/start-allocation', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.currentRound !== 0 || config.status !== 'SETUP') {
        throw new Error('INVALID_STATE');
      }
      
      t.update(configRef, {
        status: 'ALLOCATION',
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Allocation started successfully' });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Invalid state transition' });
    }
    console.error('Error starting allocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/start-round-1
router.post('/start-round-1', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.currentRound !== 0 || config.status !== 'ALLOCATION') {
        throw new Error('INVALID_STATE');
      }
      
      t.update(configRef, {
        currentRound: 1,
        status: 'RUNNING',
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Round 1 started successfully' });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Invalid state transition' });
    }
    console.error('Error starting round 1:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/advance-round
router.post('/advance-round', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    
    // We need valuationService to calculate the snapshot payload
    const { calculatePortfolioValuation } = require('../services/valuationService');
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      // Step 1: Verify status and bounds (Rounds 1 to 19 can be advanced)
      if (config.status !== 'RUNNING' || config.currentRound < 1 || config.currentRound >= config.totalRounds) {
        throw new Error('INVALID_STATE');
      }
      
      const concludingRound = config.currentRound;

      // Ensure all 7 asset values exist for the concluding round
      const assetDocs = await t.get(db.collection('assetValues').where('round', '==', concludingRound));
      const assetValues = {};
      assetDocs.forEach(doc => {
        const data = doc.data();
        assetValues[data.assetClassId] = data.value;
      });

      const missingClasses = [];
      for (let i = 1; i <= 7; i++) {
        if (assetValues[i] === undefined || assetValues[i] === null) {
          missingClasses.push(i);
        }
      }

      if (missingClasses.length > 0) {
        throw new Error(`MISSING_ASSET_VALUES:${missingClasses.join(',')}`);
      }

      // Read all active portfolios
      const portfoliosDocs = await t.get(db.collection('portfolios').where('status', '==', 'ACTIVE'));

      // Process and stage snapshot creation for every active portfolio
      portfoliosDocs.forEach(doc => {
        const portfolio = doc.data();
        const teamId = portfolio.teamId || doc.id.replace('team_', '');
        
        // Calculate valuation using the temporary model
        const valuation = calculatePortfolioValuation(teamId, concludingRound, portfolio, assetValues);
        
        // Define unique snapshot document ID for idempotency
        const snapshotRef = db.collection('portfolioSnapshots').doc(`${teamId}_round_${concludingRound}`);
        
        // Write the snapshot in the transaction
        t.set(snapshotRef, {
          teamId: teamId,
          round: concludingRound,
          holdings: portfolio.holdings,
          cash: portfolio.cash,
          investedValue: valuation.totalInvestedValue,
          totalPortfolioValue: valuation.totalPortfolioValue,
          profitLoss: valuation.profitLoss,
          returnPercentage: valuation.percentageReturn,
          createdAt: FieldValue.serverTimestamp()
        });
      });

      // Update the global configuration only if all previous steps succeeded
      t.update(configRef, {
        currentRound: config.currentRound + 1,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Round advanced successfully' });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Invalid state transition' });
    }
    if (error.message.startsWith('MISSING_ASSET_VALUES:')) {
      const missing = error.message.split(':')[1];
      return res.status(409).json({ error: `Asset values are incomplete for round. Missing classes: ${missing}` });
    }
    console.error('Error advancing round:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/simulation/finish
router.post('/finish', async (req, res) => {
  try {
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    const { calculatePortfolioValuation } = require('../services/valuationService');
    
    await db.runTransaction(async (t) => {
      const config = await ensureConfigExists(t);
      
      if (config.status !== 'RUNNING' || config.currentRound !== config.totalRounds) {
        throw new Error('INVALID_STATE');
      }
      
      const concludingRound = config.currentRound;

      // Ensure all 7 asset values exist for the concluding round
      const assetDocs = await t.get(db.collection('assetValues').where('round', '==', concludingRound));
      const assetValues = {};
      assetDocs.forEach(doc => {
        const data = doc.data();
        assetValues[data.assetClassId] = data.value;
      });

      const missingClasses = [];
      for (let i = 1; i <= 7; i++) {
        if (assetValues[i] === undefined || assetValues[i] === null) {
          missingClasses.push(i);
        }
      }
      
      console.log('Finish simulation missingClasses:', missingClasses, 'assetValues:', assetValues);

      if (missingClasses.length > 0) {
        throw new Error(`MISSING_ASSET_VALUES:${missingClasses.join(',')}`);
      }

      // Read all active portfolios
      const portfoliosDocs = await t.get(db.collection('portfolios').where('status', '==', 'ACTIVE'));

      // Process and stage snapshot creation for every active portfolio
      portfoliosDocs.forEach(doc => {
        const portfolio = doc.data();
        const teamId = portfolio.teamId || doc.id.replace('team_', '');
        
        // Calculate valuation using the temporary model
        const valuation = calculatePortfolioValuation(teamId, concludingRound, portfolio, assetValues);
        
        // Define unique snapshot document ID for idempotency
        const snapshotRef = db.collection('portfolioSnapshots').doc(`${teamId}_round_${concludingRound}`);
        
        // Write the snapshot in the transaction
        t.set(snapshotRef, {
          teamId: teamId,
          round: concludingRound,
          holdings: portfolio.holdings,
          cash: portfolio.cash,
          investedValue: valuation.totalInvestedValue,
          totalPortfolioValue: valuation.totalPortfolioValue,
          profitLoss: valuation.profitLoss,
          returnPercentage: valuation.percentageReturn,
          createdAt: FieldValue.serverTimestamp()
        });
      });

      // Update the global configuration only if all previous steps succeeded
      t.update(configRef, {
        status: 'FINISHED',
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    return res.json({ message: 'Simulation finished successfully' });
  } catch (error) {
    if (error.message === 'INVALID_STATE') {
      return res.status(409).json({ error: 'Simulation cannot be finished before Round 20.' });
    }
    if (error.message.startsWith('MISSING_ASSET_VALUES:')) {
      const missing = error.message.split(':')[1];
      return res.status(409).json({ error: `Asset values are incomplete for round. Missing classes: ${missing}` });
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
      // We don't need to check current state, just forcefully reset
      const config = await ensureConfigExists(t);
      
      t.update(configRef, {
        currentRound: 0,
        status: 'SETUP',
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
