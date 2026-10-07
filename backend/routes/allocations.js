const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { authenticateRequest, requireParticipant } = require('../middleware/auth');

const SIMULATION_COLLECTION = 'simulation';
const CONFIG_DOC_ID = 'config';
const ALLOCATIONS_COLLECTION = 'allocations';

// Helper to validate allocation payload
const validateAllocationPayload = (allocations) => {
  if (!allocations || typeof allocations !== 'object') {
    return { valid: false, error: 'Allocations must be an object' };
  }

  const requiredKeys = ['1', '2', '3', '4', '5', '6', '7'];
  const keys = Object.keys(allocations);
  
  if (keys.length !== 7 || !requiredKeys.every(k => keys.includes(k))) {
    return { valid: false, error: 'Allocation must contain exactly the 7 asset classes (1-7)' };
  }

  let total = 0;
  for (const key of requiredKeys) {
    const value = allocations[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return { valid: false, error: `Invalid amount for asset class ${key}. Must be a non-negative integer.` };
    }
    total += value;
  }

  if (total > 1000000) {
    return { valid: false, error: 'Total allocated amount cannot exceed ₹10,00,000' };
  }

  return { valid: true, total, unallocated: 1000000 - total };
};

// GET /api/participant/allocation
router.get('/', authenticateRequest, requireParticipant, async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to a team.' });
    }

    const docId = `team_${teamId}_round_0`;
    const docRef = db.collection(ALLOCATIONS_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.json({
        id: docId,
        teamId,
        round: 0,
        allocations: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0 },
        allocatedAmount: 0,
        unallocatedAmount: 1000000,
        status: 'DRAFT'
      });
    }

    return res.json(docSnap.data());
  } catch (error) {
    console.error('Error fetching allocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/participant/allocation
router.put('/', authenticateRequest, requireParticipant, async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to a team.' });
    }

    const { allocations } = req.body;
    const validation = validateAllocationPayload(allocations);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const docId = `team_${teamId}_round_0`;
    const docRef = db.collection(ALLOCATIONS_COLLECTION).doc(docId);
    
    await db.runTransaction(async (t) => {
      // 1. Check Simulation config state
      const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
      const configDoc = await t.get(configRef);
      
      if (!configDoc.exists) {
        throw new Error('SIMULATION_NOT_SETUP');
      }
      const configData = configDoc.data();
      if (configData.currentRound !== 0 || configData.status !== 'ALLOCATION') {
        throw new Error('INVALID_SIMULATION_STATE');
      }

      // 2. Check existing allocation status
      const existingDoc = await t.get(docRef);
      if (existingDoc.exists && existingDoc.data().status === 'SUBMITTED') {
        throw new Error('ALREADY_SUBMITTED');
      }

      // 3. Save DRAFT
      const payload = {
        id: docId,
        teamId,
        round: 0,
        allocations,
        allocatedAmount: validation.total,
        unallocatedAmount: validation.unallocated,
        status: 'DRAFT',
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existingDoc.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }

      t.set(docRef, payload, { merge: true });
    });

    return res.json({ message: 'Draft saved successfully' });
  } catch (error) {
    if (error.message === 'INVALID_SIMULATION_STATE') {
      return res.status(409).json({ error: 'Simulation is not currently accepting initial allocations.' });
    }
    if (error.message === 'ALREADY_SUBMITTED') {
      return res.status(409).json({ error: 'Initial allocation has already been submitted and is locked.' });
    }
    if (error.message === 'SIMULATION_NOT_SETUP') {
      return res.status(500).json({ error: 'Simulation configuration missing.' });
    }
    console.error('Error saving allocation draft:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/participant/allocation/submit
router.post('/submit', authenticateRequest, requireParticipant, async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to a team.' });
    }

    const { allocations } = req.body;
    const validation = validateAllocationPayload(allocations);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const docId = `team_${teamId}_round_0`;
    const docRef = db.collection(ALLOCATIONS_COLLECTION).doc(docId);
    
    await db.runTransaction(async (t) => {
      // 1. Check Simulation config state
      const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
      const configDoc = await t.get(configRef);
      
      if (!configDoc.exists) {
        throw new Error('SIMULATION_NOT_SETUP');
      }
      const configData = configDoc.data();
      if (configData.currentRound !== 0 || configData.status !== 'ALLOCATION') {
        throw new Error('INVALID_SIMULATION_STATE');
      }

      // 2. Check existing allocation status
      const existingDoc = await t.get(docRef);
      if (existingDoc.exists && existingDoc.data().status === 'SUBMITTED') {
        throw new Error('ALREADY_SUBMITTED');
      }

      // 3. Submit allocation
      const payload = {
        id: docId,
        teamId,
        round: 0,
        allocations,
        allocatedAmount: validation.total,
        unallocatedAmount: validation.unallocated,
        status: 'SUBMITTED',
        submittedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existingDoc.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }

      t.set(docRef, payload, { merge: true });
    });

    return res.json({ message: 'Initial allocation submitted successfully' });
  } catch (error) {
    if (error.message === 'INVALID_SIMULATION_STATE') {
      return res.status(409).json({ error: 'Simulation is not currently accepting initial allocations.' });
    }
    if (error.message === 'ALREADY_SUBMITTED') {
      return res.status(409).json({ error: 'Initial allocation has already been submitted and is locked.' });
    }
    if (error.message === 'SIMULATION_NOT_SETUP') {
      return res.status(500).json({ error: 'Simulation configuration missing.' });
    }
    console.error('Error submitting allocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
