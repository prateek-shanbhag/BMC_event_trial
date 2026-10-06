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

module.exports = router;
