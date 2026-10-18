const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { authenticateRequest, requireParticipant } = require('../middleware/auth');
const { 
  CANONICAL_ASSET_CLASSES, 
  LEGACY_KEY_MAP, 
  normalizeHoldingsMap 
} = require('../services/valuationService');

const SIMULATION_COLLECTION = 'simulation';
const CONFIG_DOC_ID = 'config';
const ALLOCATIONS_COLLECTION = 'allocations';

// Rounds where Bank Fixed Deposits can be modified
const FD_MODIFIABLE_ROUNDS = [0, 6, 11];

// Helper to validate allocation payload against available capital and FD lock
const validateAllocationPayload = (rawAllocations, availableCapital, cashInput, currentRound, existingBankFD) => {
  if (!rawAllocations || typeof rawAllocations !== 'object') {
    return { valid: false, error: 'Allocations must be an object containing the 7 canonical asset classes' };
  }

  // Normalize inputs (supporting canonical keys and legacy numeric keys 1..7)
  const allocations = {};
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (rawAllocations[ac] !== undefined) {
      allocations[ac] = rawAllocations[ac];
    }
  }

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
    if (allocations[canonicalKey] === undefined && rawAllocations[legacyKey] !== undefined) {
      allocations[canonicalKey] = rawAllocations[legacyKey];
    }
  }

  // If FD is not modifiable in this round and not provided, default to existingBankFD
  const isFdModifiable = FD_MODIFIABLE_ROUNDS.includes(currentRound);
  if (!isFdModifiable && allocations.bankFixedDeposits === undefined) {
    allocations.bankFixedDeposits = existingBankFD || 0;
  }

  // Check all 7 canonical keys exist
  const missingKeys = CANONICAL_ASSET_CLASSES.filter(ac => allocations[ac] === undefined);
  if (missingKeys.length > 0) {
    return { 
      valid: false, 
      error: `Allocation must contain all 7 canonical asset classes. Missing: ${missingKeys.join(', ')}` 
    };
  }

  // Enforce Bank Fixed Deposits modification rule
  if (!isFdModifiable) {
    const attemptedFD = allocations.bankFixedDeposits;
    const expectedFD = existingBankFD || 0;
    if (attemptedFD !== expectedFD) {
      return {
        valid: false,
        error: `Bank Fixed Deposits can only be modified in Round 0, Round 6, and Round 11. Your allocation must preserve the existing value of ₹${expectedFD.toLocaleString('en-IN')}.`
      };
    }
  }

  let totalInvested = 0;
  for (const key of CANONICAL_ASSET_CLASSES) {
    const value = allocations[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return { 
        valid: false, 
        error: `Invalid amount for ${key}. Must be a non-negative integer rupee amount.` 
      };
    }
    totalInvested += value;
  }

  let cash;
  if (cashInput !== undefined && cashInput !== null) {
    if (typeof cashInput !== 'number' || !Number.isInteger(cashInput) || cashInput < 0) {
      return { valid: false, error: 'Cash amount must be a non-negative integer rupee amount.' };
    }
    cash = cashInput;
  } else {
    cash = availableCapital - totalInvested;
  }

  if (totalInvested > availableCapital) {
    return { 
      valid: false, 
      error: `Total invested amount (₹${totalInvested.toLocaleString('en-IN')}) exceeds available capital of ₹${availableCapital.toLocaleString('en-IN')}` 
    };
  }

  if (totalInvested + cash > availableCapital) {
    return { 
      valid: false, 
      error: `Total allocation including cash (₹${(totalInvested + cash).toLocaleString('en-IN')}) exceeds available capital of ₹${availableCapital.toLocaleString('en-IN')}` 
    };
  }

  if (cash < 0) {
    return { valid: false, error: 'Holdings cannot exceed available capital (cash cannot be negative).' };
  }

  return { 
    valid: true, 
    allocations,
    totalInvested, 
    cash, 
    unallocated: cash 
  };
};

// GET /api/participant/allocation
router.get('/', authenticateRequest, requireParticipant, async (req, res) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to a team.' });
    }

    // 1. Authoritative simulation state from backend
    const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
    const configDoc = await configRef.get();
    
    let currentRound = 0;
    let simulationStatus = 'SETUP';
    if (configDoc.exists) {
      const config = configDoc.data();
      currentRound = typeof config.currentRound === 'number' ? config.currentRound : 0;
      simulationStatus = config.status || 'SETUP';
    }

    // 2. Determine available capital and existing portfolio holdings
    let availableCapital = 1000000;
    let portfolioData = null;
    let existingHoldings = {};

    if (currentRound > 0) {
      const portfolioDoc = await db.collection('portfolios').doc(`team_${teamId}`).get();
      if (portfolioDoc.exists) {
        portfolioData = portfolioDoc.data();
        if (typeof portfolioData.totalPortfolioValue === 'number') {
          availableCapital = portfolioData.totalPortfolioValue;
        }
        existingHoldings = normalizeHoldingsMap(portfolioData.holdings);
      }
    }

    const isReallocationOpen = currentRound === 0 
      ? (simulationStatus === 'INITIAL_ALLOCATION_OPEN' || simulationStatus === 'ALLOCATION')
      : (simulationStatus === 'REALLOCATION_OPEN');

    const isFdModifiable = FD_MODIFIABLE_ROUNDS.includes(currentRound);
    const existingBankFD = existingHoldings.bankFixedDeposits || 0;

    // 3. Query existing allocation document for currentRound
    const docId = `team_${teamId}_round_${currentRound}`;
    const docRef = db.collection(ALLOCATIONS_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const normalizedAllocations = normalizeHoldingsMap(data.allocations);
      return res.json({
        ...data,
        allocations: normalizedAllocations,
        availableCapital,
        simulationStatus,
        isReallocationOpen,
        isFdModifiable,
        existingBankFD
      });
    }

    // 4. Return default initial / pre-filled rebalancing workbench
    const defaultInitialAllocations = {};
    CANONICAL_ASSET_CLASSES.forEach(ac => {
      defaultInitialAllocations[ac] = 0;
    });

    if (currentRound === 0) {
      return res.json({
        id: docId,
        teamId,
        round: 0,
        allocations: defaultInitialAllocations,
        cash: 1000000,
        allocatedAmount: 0,
        unallocatedAmount: 1000000,
        availableCapital: 1000000,
        status: 'DRAFT',
        simulationStatus,
        isReallocationOpen,
        isFdModifiable: true,
        existingBankFD: 0
      });
    }

    // For rounds 1..20, pre-fill with current portfolio holdings if not yet allocated
    const defaultHoldings = Object.keys(existingHoldings).length > 0 
      ? existingHoldings 
      : defaultInitialAllocations;
      
    const defaultCash = typeof portfolioData?.cash === 'number' ? portfolioData.cash : availableCapital;
    const defaultInvested = typeof portfolioData?.totalInvested === 'number' ? portfolioData.totalInvested : 0;

    return res.json({
      id: docId,
      teamId,
      round: currentRound,
      allocations: defaultHoldings,
      cash: defaultCash,
      allocatedAmount: defaultInvested,
      unallocatedAmount: defaultCash,
      availableCapital,
      status: 'DRAFT',
      simulationStatus,
      isReallocationOpen,
      isFdModifiable,
      existingBankFD
    });

  } catch (error) {
    console.error('Error fetching allocation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper for saving draft or submitting allocation
const processAllocationMutation = async (req, res, isSubmit) => {
  try {
    const teamId = req.user.teamId;
    if (!teamId) {
      return res.status(403).json({ error: 'You are not assigned to a team.' });
    }

    const { allocations: rawAllocations, cash: cashInput } = req.body;

    await db.runTransaction(async (t) => {
      // 1. Check Simulation config state
      const configRef = db.collection(SIMULATION_COLLECTION).doc(CONFIG_DOC_ID);
      const configDoc = await t.get(configRef);
      
      if (!configDoc.exists) {
        throw new Error('SIMULATION_NOT_SETUP');
      }
      const configData = configDoc.data();
      const currentRound = configData.currentRound;
      const status = configData.status;

      // 2. Validate simulation state
      if (currentRound === 0) {
        if (status !== 'INITIAL_ALLOCATION_OPEN' && status !== 'ALLOCATION') {
          throw new Error('INITIAL_ALLOCATION_LOCKED');
        }
      } else {
        if (status !== 'REALLOCATION_OPEN') {
          throw new Error('REALLOCATION_LOCKED');
        }
      }

      // 3. Determine available capital and existing Bank FD holdings
      let availableCapital = 1000000;
      let existingBankFD = 0;
      if (currentRound > 0) {
        const portfolioDoc = await t.get(db.collection('portfolios').doc(`team_${teamId}`));
        if (portfolioDoc.exists) {
          const pData = portfolioDoc.data();
          if (typeof pData.totalPortfolioValue === 'number') {
            availableCapital = pData.totalPortfolioValue;
          }
          const normalizedExisting = normalizeHoldingsMap(pData.holdings);
          existingBankFD = normalizedExisting.bankFixedDeposits || 0;
        }
      }

      // 4. Validate payload with canonical asset classes and Bank FD restrictions
      const validation = validateAllocationPayload(
        rawAllocations, 
        availableCapital, 
        cashInput, 
        currentRound, 
        existingBankFD
      );
      
      if (!validation.valid) {
        const err = new Error(validation.error);
        err.statusCode = 400;
        throw err;
      }

      // 5. Check existing allocation status
      const docId = `team_${teamId}_round_${currentRound}`;
      const docRef = db.collection(ALLOCATIONS_COLLECTION).doc(docId);
      const existingDoc = await t.get(docRef);

      if (existingDoc.exists && existingDoc.data().status === 'SUBMITTED') {
        throw new Error('ALREADY_SUBMITTED');
      }

      // 6. Write allocation document
      const payload = {
        id: docId,
        teamId,
        round: currentRound,
        allocations: validation.allocations,
        cash: validation.cash,
        allocatedAmount: validation.totalInvested,
        unallocatedAmount: validation.cash,
        availableCapital,
        status: isSubmit ? 'SUBMITTED' : 'DRAFT',
        updatedAt: FieldValue.serverTimestamp()
      };

      if (isSubmit) {
        payload.submittedAt = FieldValue.serverTimestamp();
      }

      if (!existingDoc.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }

      t.set(docRef, payload, { merge: true });
    });

    return res.json({ 
      message: isSubmit 
        ? 'Allocation submitted successfully' 
        : 'Draft saved successfully' 
    });

  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'INITIAL_ALLOCATION_LOCKED') {
      return res.status(409).json({ error: 'Simulation is not currently accepting initial allocations.' });
    }
    if (error.message === 'REALLOCATION_LOCKED') {
      return res.status(409).json({ error: 'Reallocation is not currently open for this round.' });
    }
    if (error.message === 'ALREADY_SUBMITTED') {
      return res.status(409).json({ error: 'Allocation has already been submitted for this round and is locked.' });
    }
    if (error.message === 'SIMULATION_NOT_SETUP') {
      return res.status(500).json({ error: 'Simulation configuration missing.' });
    }
    console.error('Error processing allocation mutation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/participant/allocation (Save Draft)
router.put('/', authenticateRequest, requireParticipant, (req, res) => {
  return processAllocationMutation(req, res, false);
});

// POST /api/participant/allocation/submit (Submit Allocation)
router.post('/submit', authenticateRequest, requireParticipant, (req, res) => {
  return processAllocationMutation(req, res, true);
});

module.exports = router;
