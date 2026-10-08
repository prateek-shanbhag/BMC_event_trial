/**
 * TEMPORARY DEVELOPMENT VALUATION MODEL 
 * — replace when official financial rules are finalized.
 */

const BASE_ASSET_VALUE = 100;

function calculateAssetValuation(holdingAmount, currentAssetValue) {
  // Temporary formula
  return holdingAmount * (currentAssetValue / BASE_ASSET_VALUE);
}

function calculatePortfolioValuation(teamId, round, portfolio, assetValues) {
  // Verify all 7 asset classes exist in the assetValues map
  const missingClasses = [];
  for (let i = 1; i <= 7; i++) {
    if (assetValues[i] === undefined || assetValues[i] === null || !Number.isFinite(assetValues[i])) {
      missingClasses.push(i);
    }
  }

  if (missingClasses.length > 0) {
    const error = new Error(`Asset values are incomplete for this round. Missing classes: ${missingClasses.join(', ')}`);
    error.statusCode = 409;
    throw error;
  }

  const result = {
    teamId,
    round,
    cash: portfolio.cash || 0,
    assets: {},
    totalInvestedValue: 0,
    totalPortfolioValue: 0
  };

  let totalAssetValue = 0;

  for (let i = 1; i <= 7; i++) {
    const holdingAmount = portfolio.holdings[i] || 0;
    const currentAssetValue = assetValues[i];
    
    const calculatedValue = calculateAssetValuation(holdingAmount, currentAssetValue);
    
    result.assets[i.toString()] = {
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
  result.percentageReturn = (result.profitLoss / 1000000) * 100;
  result.isTemporaryModel = true;

  return result;
}

module.exports = {
  calculateAssetValuation,
  calculatePortfolioValuation
};
