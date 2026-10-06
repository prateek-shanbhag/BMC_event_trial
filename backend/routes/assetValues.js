const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

// Helper for validation
const validateAssetValue = (round, assetClassId, value) => {
  if (round === undefined || round === null) return 'Round is required';
  const parsedRound = Number(round);
  if (!Number.isInteger(parsedRound) || parsedRound < 1 || parsedRound > 20) {
    return 'Round must be an integer between 1 and 20';
  }

  if (assetClassId === undefined || assetClassId === null) return 'Asset class ID is required';
  const parsedAssetClassId = Number(assetClassId);
  if (!Number.isInteger(parsedAssetClassId) || parsedAssetClassId < 1 || parsedAssetClassId > 7) {
    return 'Asset class ID must be an integer between 1 and 7';
  }

  if (value === undefined || value === null) return 'Value is required';
  const parsedValue = Number(value);
  if (isNaN(parsedValue) || !isFinite(parsedValue) || parsedValue <= 0) {
    return 'Value must be a finite positive number';
  }

  return null; // Valid
};

// GET /api/admin/asset-values
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('assetValues').get();
    const assetValues = [];
    snapshot.forEach(doc => {
      assetValues.push(doc.data());
    });
    
    // Sort by round asc, assetClassId asc
    assetValues.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.assetClassId - b.assetClassId;
    });

    return res.json({ assetValues });
  } catch (error) {
    console.error('Error fetching asset values:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/asset-values/:round
router.get('/:round', async (req, res) => {
  try {
    const round = Number(req.params.round);
    if (!Number.isInteger(round) || round < 1 || round > 20) {
      return res.status(400).json({ error: 'Round must be an integer between 1 and 20' });
    }

    const snapshot = await db.collection('assetValues').where('round', '==', round).get();
    const assetValues = [];
    snapshot.forEach(doc => {
      assetValues.push(doc.data());
    });

    // Sort by assetClassId asc
    assetValues.sort((a, b) => a.assetClassId - b.assetClassId);

    return res.json({ assetValues });
  } catch (error) {
    console.error(`Error fetching asset values for round ${req.params.round}:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/asset-values/:round/:assetClassId
router.put('/:round/:assetClassId', async (req, res) => {
  try {
    const round = Number(req.params.round);
    const assetClassId = Number(req.params.assetClassId);
    const { value } = req.body;

    const validationError = validateAssetValue(round, assetClassId, value);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const parsedValue = Number(value);
    const docId = `round_${round}_asset_${assetClassId}`;
    const docRef = db.collection('assetValues').doc(docId);

    const doc = await docRef.get();
    if (!doc.exists) {
      const newRecord = {
        id: docId,
        round,
        assetClassId,
        value: parsedValue,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await docRef.set(newRecord);
      return res.status(201).json(newRecord);
    } else {
      await docRef.update({
        value: parsedValue,
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.json({ message: 'Asset value updated successfully', id: docId, value: parsedValue });
    }
  } catch (error) {
    console.error('Error updating asset value:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/asset-values/:round/:assetClassId
router.delete('/:round/:assetClassId', async (req, res) => {
  try {
    const round = Number(req.params.round);
    const assetClassId = Number(req.params.assetClassId);

    if (!Number.isInteger(round) || round < 1 || round > 20) {
      return res.status(400).json({ error: 'Round must be an integer between 1 and 20' });
    }
    if (!Number.isInteger(assetClassId) || assetClassId < 1 || assetClassId > 7) {
      return res.status(400).json({ error: 'Asset class ID must be an integer between 1 and 7' });
    }

    const docId = `round_${round}_asset_${assetClassId}`;
    const docRef = db.collection('assetValues').doc(docId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Asset value not found' });
    }

    await docRef.delete();
    return res.json({ message: 'Asset value deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset value:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
