const { db } = require('../config/firebaseAdmin');

// Leaderboard ranking is currently a temporary prototype rule based on Round 20 totalPortfolioValue and can be replaced later.
class LeaderboardService {
  async getFinalLeaderboard() {
    // 1. Check if simulation is FINISHED
    const simDoc = await db.collection('simulation').doc('config').get();
    if (!simDoc.exists || simDoc.data().status !== 'FINISHED') {
      throw new Error('NOT_FINISHED');
    }

    // 2. Fetch all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = {};
    teamsSnapshot.forEach(doc => {
      teams[doc.id] = doc.data();
    });

    // 3. Fetch all round 20 portfolio snapshots
    const snapshotsRef = await db.collection('portfolioSnapshots').where('round', '==', 20).get();
    const results = [];

    snapshotsRef.forEach(doc => {
      const data = doc.data();
      const teamId = data.teamId;
      const teamData = teams[teamId];
      if (!teamData) return; // Ignore if team doesn't exist

      // Initial capital is assumed to be 10,00,000 for profit/loss calculation
      const initialCapital = 1000000;
      const totalPortfolioValue = data.totalPortfolioValue;
      const profitLoss = totalPortfolioValue - initialCapital;
      const returnPercentage = (profitLoss / initialCapital) * 100;

      results.push({
        teamId: teamId,
        teamName: teamData.name || `Team ${teamId}`,
        totalPortfolioValue: totalPortfolioValue,
        investedValue: data.investedValue,
        cash: data.cash,
        profitLoss: profitLoss,
        returnPercentage: returnPercentage
      });
    });

    if (results.length === 0) {
      return [];
    }

    // 4. Sort results descending by totalPortfolioValue, then by team name ascending for deterministic tie-breaking
    results.sort((a, b) => {
      if (b.totalPortfolioValue !== a.totalPortfolioValue) {
        return b.totalPortfolioValue - a.totalPortfolioValue;
      }
      return a.teamName.localeCompare(b.teamName);
    });

    // 5. Assign ranks with tie handling
    let currentRank = 1;
    let rankCounter = 1;
    let previousValue = results[0].totalPortfolioValue;

    for (let i = 0; i < results.length; i++) {
      if (results[i].totalPortfolioValue < previousValue) {
        currentRank = rankCounter;
      }
      results[i].rank = currentRank;
      previousValue = results[i].totalPortfolioValue;
      rankCounter++;
    }

    return results;
  }
}

module.exports = new LeaderboardService();
