const express = require('express');
const { db } = require('../config/firebaseAdmin');

const adminRouter = express.Router();
const participantRouter = express.Router();
const valuationService = require('../services/valuationService');
const { 
  CANONICAL_ASSET_CLASSES, 
  normalizeHoldingsMap, 
  normalizeAssetValuesMap 
} = valuationService;

// ADMIN: Get all portfolios
adminRouter.get('/', async (req, res) => {
  try {
    const portfoliosSnapshot = await db.collection('portfolios').get();
    const teamsSnapshot = await db.collection('teams').get();
    
    const teamMap = {};
    teamsSnapshot.forEach(doc => {
      teamMap[doc.id] = doc.data().name;
    });

    const portfolios = [];
    portfoliosSnapshot.forEach(doc => {
      const data = doc.data();
      data.teamName = teamMap[data.teamId] || data.teamId;
      data.holdings = normalizeHoldingsMap(data.holdings);
      portfolios.push(data);
    });
    res.status(200).json({ portfolios });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

// ADMIN: Get portfolio by teamId
adminRouter.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const portfolioDoc = await db.collection('portfolios').doc(`team_${teamId}`).get();
    
    if (!portfolioDoc.exists) {
      return res.status(404).json({ error: 'Portfolio not found for this team' });
    }
    
    const data = portfolioDoc.data();
    data.holdings = normalizeHoldingsMap(data.holdings);
    res.status(200).json({ portfolio: data });
  } catch (error) {
    console.error('Error fetching team portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch team portfolio' });
  }
});

// ADMIN: Initialize portfolios from Round 0 allocations
adminRouter.post('/initialize', async (req, res) => {
  try {
    const initialized = [];
    const alreadyInitialized = [];
    const skipped = [];

    // Find all teams and Round 0 allocations
    const teamsSnapshot = await db.collection('teams').get();
    const allocationsSnapshot = await db.collection('allocations')
      .where('round', '==', 0)
      .get();
      
    const allocationsByTeam = {};
    allocationsSnapshot.forEach(doc => {
      allocationsByTeam[doc.data().teamId] = doc.data();
    });

    const processPromises = teamsSnapshot.docs.map(async (teamDoc) => {
      const teamId = teamDoc.id;
      const allocation = allocationsByTeam[teamId];
      const portfolioRef = db.collection('portfolios').doc(`team_${teamId}`);
      const snapshotRef = db.collection('portfolioSnapshots').doc(`team_${teamId}_round_0`);
      
      try {
        await db.runTransaction(async (t) => {
          const portfolioDoc = await t.get(portfolioRef);
          
          if (portfolioDoc.exists) {
            alreadyInitialized.push(teamId);
            return;
          }
          
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
          
          const now = new Date().toISOString();
          
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
          
          t.set(portfolioRef, portfolioData);
          t.set(snapshotRef, snapshotData);
          initialized.push(teamId);
        });
      } catch (err) {
        console.error(`Error initializing portfolio for team ${teamId}:`, err);
        skipped.push(teamId);
      }
    });

    await Promise.all(processPromises);

    // If simulation state is INITIAL_ALLOCATION_OPEN, advance to Round 1 ROUND_PREPARATION
    try {
      const simRef = db.collection('simulation').doc('config');
      const simDoc = await simRef.get();
      if (simDoc.exists) {
        const simData = simDoc.data();
        if (simData.currentRound === 0 && (simData.status === 'INITIAL_ALLOCATION_OPEN' || simData.status === 'ALLOCATION')) {
          await simRef.update({
            currentRound: 1,
            status: 'ROUND_PREPARATION',
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (simErr) {
      console.warn('Could not advance simulation state during portfolio initialize:', simErr.message);
    }

    res.status(200).json({
      initialized,
      alreadyInitialized,
      skipped
    });

  } catch (error) {
    console.error('Error initializing portfolios:', error);
    res.status(500).json({ error: 'Failed to initialize portfolios' });
  }
});

// ADMIN: Calculate Temporary Valuation
adminRouter.get('/:teamId/valuation/:round', async (req, res) => {
  try {
    const { teamId, round } = req.params;
    const roundNumber = parseInt(round, 10);
    
    if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 20) {
      return res.status(400).json({ error: 'Valuation is available only for rounds 1–20.' });
    }

    const portfolioDoc = await db.collection('portfolios').doc(`team_${teamId}`).get();
    if (!portfolioDoc.exists) {
      return res.status(404).json({ error: 'Portfolio not found for this team' });
    }

    const assetValuesSnapshot = await db.collection('assetValues').where('round', '==', roundNumber).get();
    if (assetValuesSnapshot.empty) {
      return res.status(409).json({ error: 'Asset values are not configured for this round.' });
    }

    const rawValues = {};
    assetValuesSnapshot.forEach(doc => {
      const data = doc.data();
      rawValues[data.assetClassId] = data.value;
    });

    const portfolio = portfolioDoc.data();
    portfolio.holdings = normalizeHoldingsMap(portfolio.holdings);
    
    const valuation = valuationService.calculatePortfolioValuation(teamId, roundNumber, portfolio, rawValues);
    
    res.status(200).json(valuation);
  } catch (error) {
    console.error('Error in admin valuation:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to calculate valuation' });
  }
});

// ADMIN: Get team's portfolio history
adminRouter.get('/:teamId/history', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const snapshotsRef = db.collection('portfolioSnapshots');
    const snapshotDocs = await snapshotsRef
      .where('teamId', '==', teamId)
      .get();
      
    const history = [];
    snapshotDocs.forEach(doc => {
      const snap = doc.data();
      snap.holdings = normalizeHoldingsMap(snap.holdings);
      history.push(snap);
    });
    
    // Sort in memory by round ascending
    history.sort((a, b) => a.round - b.round);
    
    res.status(200).json({ history });
  } catch (error) {
    console.error('Error fetching admin history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

// PARTICIPANT: Get own team's portfolio
participantRouter.get('/', async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to any team.' });
    }
    
    const portfolioDoc = await db.collection('portfolios').doc(`team_${teamId}`).get();
    
    if (!portfolioDoc.exists) {
      return res.status(404).json({ error: 'Portfolio has not been initialized yet.' });
    }
    
    const data = portfolioDoc.data();
    data.holdings = normalizeHoldingsMap(data.holdings);
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching participant portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// PARTICIPANT: Get own team's valuation
participantRouter.get('/valuation/:round', async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to any team.' });
    }
    
    const { round } = req.params;
    const roundNumber = parseInt(round, 10);
    
    if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 20) {
      return res.status(400).json({ error: 'Valuation is available only for rounds 1–20.' });
    }

    const portfolioDoc = await db.collection('portfolios').doc(`team_${teamId}`).get();
    if (!portfolioDoc.exists) {
      return res.status(404).json({ error: 'Portfolio not found for your team.' });
    }

    const assetValuesSnapshot = await db.collection('assetValues').where('round', '==', roundNumber).get();
    if (assetValuesSnapshot.empty) {
      return res.status(409).json({ error: 'Asset values are not configured for this round.' });
    }

    const rawValues = {};
    assetValuesSnapshot.forEach(doc => {
      const data = doc.data();
      rawValues[data.assetClassId] = data.value;
    });

    const portfolio = portfolioDoc.data();
    portfolio.holdings = normalizeHoldingsMap(portfolio.holdings);
    
    const valuation = valuationService.calculatePortfolioValuation(teamId, roundNumber, portfolio, rawValues);
    
    res.status(200).json(valuation);
  } catch (error) {
    console.error('Error in participant valuation:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to calculate valuation' });
  }
});

// PARTICIPANT: Get own team's portfolio history
participantRouter.get('/history', async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to any team.' });
    }
    
    const snapshotsRef = db.collection('portfolioSnapshots');
    const snapshotDocs = await snapshotsRef
      .where('teamId', '==', teamId)
      .get();
      
    const history = [];
    snapshotDocs.forEach(doc => {
      const snap = doc.data();
      snap.holdings = normalizeHoldingsMap(snap.holdings);
      history.push(snap);
    });
    
    // Sort in memory by round ascending
    history.sort((a, b) => a.round - b.round);
    
    res.status(200).json({ history });
  } catch (error) {
    console.error('Error fetching participant history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

module.exports = { adminRouter, participantRouter };
