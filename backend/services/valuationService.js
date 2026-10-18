/**
 * TEMPORARY DEVELOPMENT VALUATION MODEL 
 * — replace when official financial rules are finalized.
 *
 * Canonical Asset Model (Exactly 7 asset classes):
 * 1. assetClass1
 * 2. assetClass2
 * 3. assetClass3
 * 4. governmentSecurities
 * 5. bankFixedDeposits
 * 6. realEstate
 * 7. gold
 *
 * Cash is completely separate and must never be treated as an asset class.
 */

const BASE_ASSET_VALUE = 100;

const CANONICAL_ASSET_CLASSES = [
  'assetClass1',
  'assetClass2',
  'assetClass3',
  'governmentSecurities',
  'bankFixedDeposits',
  'realEstate',
  'gold'
];

const LEGACY_KEY_MAP = {
  '1': 'assetClass1',
  '2': 'assetClass2',
  '3': 'assetClass3',
  '4': 'governmentSecurities',
  '5': 'bankFixedDeposits',
  '6': 'realEstate',
  '7': 'gold'
};

function normalizeAssetKey(key) {
  if (CANONICAL_ASSET_CLASSES.includes(key)) return key;
  if (LEGACY_KEY_MAP[key]) return LEGACY_KEY_MAP[key];
  return null;
}

function normalizeAssetValuesMap(rawMap) {
  const normalized = {};
  if (!rawMap || typeof rawMap !== 'object') return normalized;
  
  // First load canonical keys if present
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (rawMap[ac] !== undefined && rawMap[ac] !== null && Number.isFinite(rawMap[ac])) {
      normalized[ac] = rawMap[ac];
    }
  }
  
  // Next check legacy keys for backwards-compatibility
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
    if (normalized[canonicalKey] === undefined) {
      if (rawMap[legacyKey] !== undefined && rawMap[legacyKey] !== null && Number.isFinite(rawMap[legacyKey])) {
        normalized[canonicalKey] = rawMap[legacyKey];
      }
    }
  }
  return normalized;
}

function normalizeHoldingsMap(rawHoldings) {
  const normalized = {};
  if (!rawHoldings || typeof rawHoldings !== 'object') {
    CANONICAL_ASSET_CLASSES.forEach(ac => { normalized[ac] = 0; });
    return normalized;
  }

  // Load canonical keys
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (typeof rawHoldings[ac] === 'number') {
      normalized[ac] = rawHoldings[ac];
    }
  }

  // Load legacy keys if canonical not provided
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
    if (normalized[canonicalKey] === undefined && typeof rawHoldings[legacyKey] === 'number') {
      normalized[canonicalKey] = rawHoldings[legacyKey];
    }
  }

  // Ensure all 7 canonical keys exist with non-negative numbers
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (typeof normalized[ac] !== 'number' || normalized[ac] < 0) {
      normalized[ac] = 0;
    }
  }

  return normalized;
}

function calculateAssetValuation(holdingAmount, currentAssetValue) {
  // Temporary formula: holdingAmount * (currentAssetValue / 100)
  return Math.round(holdingAmount * (currentAssetValue / BASE_ASSET_VALUE));
}

function calculatePortfolioValuation(teamId, round, portfolio, assetValuesRaw) {
  const assetValues = normalizeAssetValuesMap(assetValuesRaw);

  // Verify all 7 asset classes exist in the assetValues map
  const missingClasses = [];
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (assetValues[ac] === undefined || assetValues[ac] === null || !Number.isFinite(assetValues[ac])) {
      missingClasses.push(ac);
    }
  }

  if (missingClasses.length > 0) {
    const error = new Error(`Asset values are incomplete for this round. Missing classes: ${missingClasses.join(', ')}`);
    error.statusCode = 409;
    error.missingClasses = missingClasses;
    throw error;
  }

  const normalizedHoldings = normalizeHoldingsMap(portfolio.holdings);
  const result = {
    teamId,
    round,
    cash: typeof portfolio.cash === 'number' ? portfolio.cash : 0,
    assets: {},
    totalInvestedValue: 0,
    totalPortfolioValue: 0
  };

  let totalAssetValue = 0;

  for (const ac of CANONICAL_ASSET_CLASSES) {
    const holdingAmount = normalizedHoldings[ac] || 0;
    const currentAssetValue = assetValues[ac];
    const calculatedValue = calculateAssetValuation(holdingAmount, currentAssetValue);
    
    result.assets[ac] = {
      holding: holdingAmount,
      assetValue: currentAssetValue,
      calculatedValue: calculatedValue
    };
    
    totalAssetValue += calculatedValue;
  }

  result.totalInvestedValue = totalAssetValue;
  result.totalPortfolioValue = totalAssetValue + result.cash;

  // Temporary metrics
  result.profitLoss = result.totalPortfolioValue - 1000000;
  result.percentageReturn = parseFloat(((result.profitLoss / 1000000) * 100).toFixed(2));
  result.isTemporaryModel = true;

  return result;
}

/**
 * TEMPORARY DEVELOPMENT ROUND SETTLEMENT MODEL
 * - asset settlement value = submitted asset allocation * (configured round asset value / 100)
 * - cash settlement value = submitted cash allocation
 * - next portfolio value = sum(settled assets) + settled cash
 * - clearly marked as temporary development model
 */
function settleRoundValuation(teamId, round, allocation, assetValuesRaw) {
  const assetValues = normalizeAssetValuesMap(assetValuesRaw);

  // Verify all 7 asset classes exist in the assetValues map
  const missingClasses = [];
  for (const ac of CANONICAL_ASSET_CLASSES) {
    if (assetValues[ac] === undefined || assetValues[ac] === null || !Number.isFinite(assetValues[ac])) {
      missingClasses.push(ac);
    }
  }

  if (missingClasses.length > 0) {
    const error = new Error(`Asset values are incomplete for this round. Missing classes: ${missingClasses.join(', ')}`);
    error.statusCode = 409;
    error.missingClasses = missingClasses;
    throw error;
  }

  const rawHoldings = allocation.holdings || allocation.allocations || {};
  const normalizedSubmitted = normalizeHoldingsMap(rawHoldings);
  const settledHoldings = {};
  let totalSettledInvested = 0;

  for (const ac of CANONICAL_ASSET_CLASSES) {
    const allocatedRupees = normalizedSubmitted[ac] || 0;
    const currentAssetVal = assetValues[ac];
    const settledValue = calculateAssetValuation(allocatedRupees, currentAssetVal);
    settledHoldings[ac] = settledValue;
    totalSettledInvested += settledValue;
  }

  const cash = typeof allocation.cash === 'number' 
    ? allocation.cash 
    : (typeof allocation.unallocatedAmount === 'number' ? allocation.unallocatedAmount : 0);
    
  const nextPortfolioValue = totalSettledInvested + cash;
  const profitLoss = nextPortfolioValue - 1000000;
  const percentageReturn = parseFloat(((profitLoss / 1000000) * 100).toFixed(2));

  return {
    teamId,
    round,
    settledHoldings,
    submittedHoldings: normalizedSubmitted,
    cash,
    totalInvestedValue: totalSettledInvested,
    totalPortfolioValue: nextPortfolioValue,
    profitLoss,
    percentageReturn,
    isTemporaryModel: true
  };
}

module.exports = {
  CANONICAL_ASSET_CLASSES,
  LEGACY_KEY_MAP,
  normalizeAssetKey,
  normalizeAssetValuesMap,
  normalizeHoldingsMap,
  calculateAssetValuation,
  calculatePortfolioValuation,
  settleRoundValuation
};
