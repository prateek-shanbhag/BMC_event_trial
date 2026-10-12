const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboardService');

// GET /leaderboard
router.get('/', async (req, res) => {
  try {
    const leaderboard = await leaderboardService.getFinalLeaderboard();
    return res.json({ leaderboard });
  } catch (error) {
    if (error.message === 'NOT_FINISHED') {
      return res.status(409).json({ error: 'Final leaderboard is available only after the simulation is finished.' });
    }
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
