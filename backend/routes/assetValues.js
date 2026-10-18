const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { CANONICAL_ASSET_CLASSES, normalizeAssetKey } = require('../services/valuationService');

// Helper for validation
const validateAssetValue = (round, assetClassId, value) => {
  if (round === undefined || round === null) return 'Round is required';
  const parsedRound = Number(round);
  if (!Number.isInteger(parsedRound) || parsedRound < 1 || parsedRound > 20) {
    return 'Round must be an integer between 1 and 20';
  }

  if (!assetClassId) return 'Asset class ID is required';
  const canonicalKey = normalizeAssetKey(assetClassId.toString());
  if (!canonicalKey) {
    return `Asset class ID must be one of: ${CANONICAL_ASSET_CLASSES.join(', ')}`;
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
      const data = doc.data();
      const canonicalKey = normalizeAssetKey(data.assetClassId?.toString());
      if (canonicalKey) {
        data.assetClassId = canonicalKey;
      }
      assetValues.push(data);
    });
    
    // Sort by round asc
    assetValues.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return String(a.assetClassId).localeCompare(String(b.assetClassId));
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
      const data = doc.data();
      const canonicalKey = normalizeAssetKey(data.assetClassId?.toString());
      if (canonicalKey) {
        data.assetClassId = canonicalKey;
      }
      assetValues.push(data);
    });

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
    const rawAssetClassId = req.params.assetClassId;
    const { value } = req.body;

    const validationError = validateAssetValue(round, rawAssetClassId, value);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const canonicalKey = normalizeAssetKey(rawAssetClassId.toString());
    const parsedValue = Number(value);
    
    // Primary docId using canonical key
    const docId = `round_${round}_asset_${canonicalKey}`;
    const docRef = db.collection('assetValues').doc(docId);

    // Also check legacy doc ID if it exists: `round_${round}_asset_${rawAssetClassId}`
    const legacyDocId = `round_${round}_asset_${rawAssetClassId}`;
    const legacyRef = db.collection('assetValues').doc(legacyDocId);

    const [doc, legacyDoc] = await Promise.all([docRef.get(), legacyRef.get()]);
    const targetRef = doc.exists ? docRef : (legacyDoc.exists ? legacyRef : docRef);
    const targetExists = doc.exists || legacyDoc.exists;

    if (!targetExists) {
      const newRecord = {
        id: docId,
        round,
        assetClassId: canonicalKey,
        value: parsedValue,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await docRef.set(newRecord);
      return res.status(201).json(newRecord);
    } else {
      await targetRef.update({
        assetClassId: canonicalKey,
        value: parsedValue,
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.json({ 
        message: 'Asset value updated successfully', 
        id: targetRef.id, 
        assetClassId: canonicalKey, 
        value: parsedValue 
      });
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
    const rawAssetClassId = req.params.assetClassId;

    if (!Number.isInteger(round) || round < 1 || round > 20) {
      return res.status(400).json({ error: 'Round must be an integer between 1 and 20' });
    }
    
    const canonicalKey = normalizeAssetKey(rawAssetClassId.toString());
    if (!canonicalKey) {
      return res.status(400).json({ error: `Asset class ID must be one of: ${CANONICAL_ASSET_CLASSES.join(', ')}` });
    }

    const docId = `round_${round}_asset_${canonicalKey}`;
    const docRef = db.collection('assetValues').doc(docId);
    const legacyDocId = `round_${round}_asset_${rawAssetClassId}`;
    const legacyRef = db.collection('assetValues').doc(legacyDocId);

    const [doc, legacyDoc] = await Promise.all([docRef.get(), legacyRef.get()]);
    if (!doc.exists && !legacyDoc.exists) {
      return res.status(404).json({ error: 'Asset value not found' });
    }

    if (doc.exists) await docRef.delete();
    if (legacyDoc.exists && legacyDocId !== docId) await legacyRef.delete();

    return res.json({ message: 'Asset value deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset value:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
