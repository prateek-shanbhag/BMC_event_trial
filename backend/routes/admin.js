const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Create a new team
router.post('/teams', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Valid team name is required' });
    }

    const teamRef = db.collection('teams').doc();
    const newTeam = {
      teamId: teamRef.id,
      name: name.trim(),
      memberUids: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await teamRef.set(newTeam);
    
    return res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List all teams
router.get('/teams', async (req, res) => {
  try {
    const teamsSnapshot = await db.collection('teams').get();
    
    const teams = [];
    teamsSnapshot.forEach(doc => {
      teams.push({ id: doc.id, ...doc.data() });
    });

    // Populate member details
    for (let team of teams) {
      team.members = [];
      if (team.memberUids && team.memberUids.length > 0) {
        const usersSnapshot = await db.collection('users')
          .where('uid', 'in', team.memberUids)
          .get();
        
        usersSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          team.members.push({
            uid: userData.uid,
            email: userData.email,
            name: userData.name
          });
        });
      }
    }

    return res.json({ teams });
  } catch (error) {
    console.error('Error listing teams:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign participant to team
router.post('/teams/:teamId/members', async (req, res) => {
  const { teamId } = req.params;
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'User UID is required' });
  }

  try {
    await db.runTransaction(async (t) => {
      // Get the team
      const teamRef = db.collection('teams').doc(teamId);
      const teamDoc = await t.get(teamRef);

      if (!teamDoc.exists) {
        throw new Error('Team not found');
      }

      // Get the user
      const userRef = db.collection('users').doc(uid);
      const userDoc = await t.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (userData.role !== 'PARTICIPANT') {
        throw new Error('User is not a PARTICIPANT');
      }

      const oldTeamId = userData.teamId;

      // If user is already in this team, nothing to do
      if (oldTeamId === teamId) {
        return;
      }

      // Remove from old team if necessary
      if (oldTeamId) {
        const oldTeamRef = db.collection('teams').doc(oldTeamId);
        t.update(oldTeamRef, {
          memberUids: FieldValue.arrayRemove(uid),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      // Add to new team
      t.update(teamRef, {
        memberUids: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update user document
      t.update(userRef, {
        teamId: teamId,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return res.json({ message: 'Participant assigned successfully' });
  } catch (error) {
    console.error('Error assigning participant:', error);
    if (error.message === 'Team not found' || error.message === 'User not found' || error.message === 'User is not a PARTICIPANT') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove participant from team
router.delete('/teams/:teamId/members/:uid', async (req, res) => {
  const { teamId, uid } = req.params;

  try {
    await db.runTransaction(async (t) => {
      // Get the team
      const teamRef = db.collection('teams').doc(teamId);
      const teamDoc = await t.get(teamRef);

      if (!teamDoc.exists) {
        throw new Error('Team not found');
      }

      // Get the user
      const userRef = db.collection('users').doc(uid);
      const userDoc = await t.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();

      if (userData.teamId !== teamId) {
        throw new Error('User is not in this team');
      }

      // Remove from team
      t.update(teamRef, {
        memberUids: FieldValue.arrayRemove(uid),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update user document
      t.update(userRef, {
        teamId: null,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    if (error.message === 'Team not found' || error.message === 'User not found' || error.message === 'User is not in this team') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all participants
router.get('/participants', async (req, res) => {
  try {
    const participantsSnapshot = await db.collection('users')
      .where('role', '==', 'PARTICIPANT')
      .get();
    
    const participants = [];
    participantsSnapshot.forEach(doc => {
      const data = doc.data();
      participants.push({
        uid: data.uid,
        email: data.email,
        name: data.name,
        teamId: data.teamId || null
      });
    });

    return res.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all asset classes
router.get('/asset-classes', async (req, res) => {
  try {
    const assetClassesSnapshot = await db.collection('assetClasses').get();
    
    const assetClasses = [];
    assetClassesSnapshot.forEach(doc => {
      assetClasses.push({ id: doc.id, ...doc.data() });
    });

    // Sort by integer ID
    assetClasses.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    return res.json({ assetClasses });
  } catch (error) {
    console.error('Error fetching asset classes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
