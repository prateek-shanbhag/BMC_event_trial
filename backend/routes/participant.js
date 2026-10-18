const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');

// Get current participant's team
router.get('/team', async (req, res) => {
  try {
    const uid = req.user.uid;
    const teamId = req.user.teamId;

    if (!teamId) {
      return res.json({ team: null });
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      // Inconsistent state: user has teamId but team doesn't exist
      return res.json({ team: null });
    }

    const teamData = { id: teamDoc.id, ...teamDoc.data() };
    teamData.members = [];

    if (teamData.memberUids && teamData.memberUids.length > 0) {
      const usersSnapshot = await db.collection('users')
        .where('uid', 'in', teamData.memberUids)
        .get();
      
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        teamData.members.push({
          uid: userData.uid,
          email: userData.email,
          name: userData.name
        });
      });
    }

    return res.json({ team: teamData });
  } catch (error) {
    console.error('Error fetching participant team:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current simulation state
router.get('/simulation-state', async (req, res) => {
  try {
    const configRef = db.collection('simulation').doc('config');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      return res.json({
        startingCapital: 1000000,
        totalRounds: 20,
        allocationWindowSeconds: 120,
        currentRound: 0,
        status: "SETUP"
      });
    }

    const config = configDoc.data();
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

// Get published news for current simulation round
router.get('/news', async (req, res) => {
  try {
    // 1. Authoritative simulation state from backend
    const configRef = db.collection('simulation').doc('config');
    const configDoc = await configRef.get();
    
    let currentRound = 0;
    if (configDoc.exists) {
      const config = configDoc.data();
      currentRound = typeof config.currentRound === 'number' ? config.currentRound : 0;
    }

    // Round 0 (SETUP / ALLOCATION) has no round-specific news
    if (currentRound <= 0) {
      return res.json({ news: [], currentRound: 0 });
    }

    // 2. Query published news for current round only
    let newsSnapshot;
    try {
      newsSnapshot = await db.collection('news')
        .where('round', '==', currentRound)
        .where('status', '==', 'PUBLISHED')
        .get();
    } catch (queryErr) {
      console.warn('Direct query failed, falling back to round filter:', queryErr.message);
      newsSnapshot = await db.collection('news')
        .where('round', '==', currentRound)
        .get();
    }

    const newsList = [];
    newsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'PUBLISHED' && data.round === currentRound) {
        newsList.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          round: data.round,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null
        });
      }
    });

    // 3. Sort by createdAt descending
    newsList.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    return res.json({ news: newsList, currentRound });
  } catch (error) {
    console.error('Error fetching participant news:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
