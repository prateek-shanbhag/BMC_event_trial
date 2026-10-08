const express = require('express');
const { db } = require('../config/firebaseAdmin');

const adminRouter = express.Router();
const participantRouter = express.Router();
const valuationService = require('../services/valuationService');

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
    
    res.status(200).json({ portfolio: portfolioDoc.data() });
  } catch (error) {
    console.error('Error fetching team portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch team portfolio' });
  }
});

// ADMIN: Initialize portfolios from SUBMITTED Round 0 allocations
adminRouter.post('/initialize', async (req, res) => {
  try {
    const initialized = [];
    const alreadyInitialized = [];
    const skipped = [];

    // Run within a transaction to ensure atomicity for each team's portfolio initialization
    // Wait, multiple teams might exceed transaction limits if there are many, but since it's a batch/transaction 
    // for each team separately or altogether? Let's process each team in its own transaction or batch to be safe.
    
    // First, find all submitted Round 0 allocations
    const allocationsSnapshot = await db.collection('allocations')
      .where('round', '==', 0)
      .where('status', '==', 'SUBMITTED')
      .get();
      
    const processPromises = allocationsSnapshot.docs.map(async (allocationDoc) => {
      const allocation = allocationDoc.data();
      const teamId = allocation.teamId;
      const portfolioRef = db.collection('portfolios').doc(`team_${teamId}`);
      const snapshotRef = db.collection('portfolioSnapshots').doc(`team_${teamId}_round_0`);
      
      try {
        await db.runTransaction(async (t) => {
          const portfolioDoc = await t.get(portfolioRef);
          
          if (portfolioDoc.exists) {
            alreadyInitialized.push(teamId);
            return;
          }
          
          const holdings = allocation.allocations;
          const totalInvested = allocation.allocatedAmount;
          const cash = 1000000 - totalInvested;
          
          const now = new Date().toISOString(); // or use admin.firestore.FieldValue.serverTimestamp() but we don't import admin here directly easily, standard JS date is fine for now as we did elsewhere.
          
          const portfolioData = {
            id: `team_${teamId}`,
            teamId,
            currentRound: 0,
            holdings,
            totalInvested,
            cash,
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

    const assetValues = {};
    assetValuesSnapshot.forEach(doc => {
      const data = doc.data();
      assetValues[data.assetClassId] = data.value;
    });

    const portfolio = portfolioDoc.data();
    
    const valuation = valuationService.calculatePortfolioValuation(teamId, roundNumber, portfolio, assetValues);
    
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
      history.push(doc.data());
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
    
    res.status(200).json(portfolioDoc.data());
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

    const assetValues = {};
    assetValuesSnapshot.forEach(doc => {
      const data = doc.data();
      assetValues[data.assetClassId] = data.value;
    });

    const portfolio = portfolioDoc.data();
    
    const valuation = valuationService.calculatePortfolioValuation(teamId, roundNumber, portfolio, assetValues);
    
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
      history.push(doc.data());
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
