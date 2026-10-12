const fetch = require('node-fetch');
const { db, app } = require('../config/firebaseAdmin');
const { getTestCredentials, loginTestUser, assertDestructiveOperationsAllowed } = require('./testSecurityGuard');

const API_BASE = 'http://localhost:5000/api';

const results = {};
function report(section, status, reason = null) {
  results[section] = { status, reason };
  console.log(`[${status}] ${section}` + (reason ? `: ${reason}` : ''));
}

async function runTests() {
  const creds = getTestCredentials();

  let adminToken, userToken;
  try {
    adminToken = await loginTestUser(creds.apiKey, creds.adminEmail, creds.adminPassword);
    userToken = await loginTestUser(creds.apiKey, creds.participantEmail, creds.participantPassword);
  } catch (e) {
    console.error('Failed to login:', e.message);
    return;
  }

  const req = async (path, method = 'GET', body = null, token) => {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data, ok: res.ok };
  };

  try {
    // Reset DB and make sure simulation is not FINISHED
    await req('/admin/simulation/reset', 'POST', null, adminToken);
    
    // Clear simulation collections (teams and users are protected and never deleted)
    const collections = ['allocations', 'portfolios', 'portfolioSnapshots', 'assetValues'];
    const targetProjectId = app.options.projectId || db.projectId || process.env.FIREBASE_PROJECT_ID;
    assertDestructiveOperationsAllowed(collections, targetProjectId);

    for (const c of collections) {
      const docs = await db.collection(c).get();
      const batch = db.batch();
      docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.log("DB cleaned.");

    // We need at least two teams for tie-breaking test
    const team1Ref = db.collection('teams').doc('team_A');
    await team1Ref.set({ teamId: 'team_A', name: 'Team Alpha' });
    const team2Ref = db.collection('teams').doc('team_B');
    await team2Ref.set({ teamId: 'team_B', name: 'Team Beta' });

    // Update user to be in team_A
    const ptUserDoc = await db.collection('users').where('email', '==', creds.participantEmail).limit(1).get();
    if (!ptUserDoc.empty) {
      await ptUserDoc.docs[0].ref.update({ teamId: 'team_A' });
    }

    await req('/admin/simulation/start-allocation', 'POST', null, adminToken);
    
    // Test 1: Admin leaderboard when not FINISHED (409)
    let res1 = await req('/admin/leaderboard', 'GET', null, adminToken);
    report('Test 1: Admin leaderboard before FINISHED (409)', res1.status === 409 ? 'PASS' : 'FAIL', `status ${res1.status}`);

    // Test 2: Participant leaderboard when not FINISHED (409)
    let res2 = await req('/participant/leaderboard', 'GET', null, userToken);
    report('Test 2: Participant leaderboard before FINISHED (409)', res2.status === 409 ? 'PASS' : 'FAIL', `status ${res2.status}`);

    // Let's mock a finished simulation directly to avoid running all 20 rounds slowly.
    await db.collection('simulation').doc('config').set({ currentRound: 20, status: 'FINISHED' });

    // Let's create some Round 20 snapshots
    await db.collection('portfolioSnapshots').doc('team_A_round_20').set({
      teamId: 'team_A', teamName: 'Team Alpha', round: 20, totalPortfolioValue: 500000, investedValue: 400000, cash: 100000, profitLoss: 100000, returnPercentage: 25.0
    });
    // Team B has same totalPortfolioValue (tie break on name)
    await db.collection('portfolioSnapshots').doc('team_B_round_20').set({
      teamId: 'team_B', teamName: 'Team Beta', round: 20, totalPortfolioValue: 500000, investedValue: 300000, cash: 200000, profitLoss: 200000, returnPercentage: 66.6
    });

    // Test 3: Admin gets leaderboard successfully (200)
    let res3 = await req('/admin/leaderboard', 'GET', null, adminToken);
    report('Test 3: Admin leaderboard after FINISHED (200)', res3.status === 200 ? 'PASS' : 'FAIL', `status ${res3.status}`);
    
    // Test 4: Participant gets leaderboard successfully (200)
    let res4 = await req('/participant/leaderboard', 'GET', null, userToken);
    report('Test 4: Participant leaderboard after FINISHED (200)', res4.status === 200 ? 'PASS' : 'FAIL', `status ${res4.status}`);

    // Test 5: Check ranking order (Team Alpha should come before Team Beta due to tie-break logic)
    if (res3.data && res3.data.leaderboard) {
      const lb = res3.data.leaderboard;
      const sortedAlphaFirst = lb[0].teamName === 'Team Alpha' && lb[1].teamName === 'Team Beta';
      report('Test 5: Ranking sort tie-break by teamName', sortedAlphaFirst ? 'PASS' : 'FAIL');
      
      // Test 6: Same rank for ties
      report('Test 6: Equal values yield same rank', (lb[0].rank === lb[1].rank) ? 'PASS' : 'FAIL');
    }

    // Test 7: Missing token (401/403)
    let res7 = await req('/admin/leaderboard', 'GET', null, 'invalid_token');
    report('Test 7: Missing/invalid token (401/403)', [401, 403].includes(res7.status) ? 'PASS' : 'FAIL', `status ${res7.status}`);

    // Test 8: Participant trying admin route (403)
    let res8 = await req('/admin/leaderboard', 'GET', null, userToken);
    report('Test 8: Participant access admin route (403)', res8.status === 403 ? 'PASS' : 'FAIL', `status ${res8.status}`);

    // Test 9: Admin trying participant route (could be 200 or 403 depending on implementation, but typically auth middleware for Participant requires role='PARTICIPANT')
    let res9 = await req('/participant/leaderboard', 'GET', null, adminToken);
    report('Test 9: Admin access participant route (403)', res9.status === 403 ? 'PASS' : 'FAIL', `status ${res9.status}`);
    
    // Add third team with higher value
    const team3Ref = db.collection('teams').doc('team_C');
    await team3Ref.set({ teamId: 'team_C', name: 'Team Charlie' });

    await db.collection('portfolioSnapshots').doc('team_C_round_20').set({
      teamId: 'team_C', teamName: 'Team Charlie', round: 20, totalPortfolioValue: 600000, investedValue: 400000, cash: 100000, profitLoss: 100000, returnPercentage: 25.0
    });

    let res10 = await req('/admin/leaderboard', 'GET', null, adminToken);
    if (res10.data && res10.data.leaderboard) {
      const lb = res10.data.leaderboard;
      report('Test 10: Charlie is rank 1', lb[0].teamName === 'Team Charlie' && lb[0].rank === 1 ? 'PASS' : 'FAIL');
      report('Test 11: Alpha is rank 2', lb[1].teamName === 'Team Alpha' && lb[1].rank === 2 ? 'PASS' : 'FAIL');
      report('Test 12: Beta is rank 2', lb[2].teamName === 'Team Beta' && lb[2].rank === 2 ? 'PASS' : 'FAIL');
    }

  } catch (err) {
    console.error('Error during tests:', err);
  }

  console.log('\n=== FINAL REPORT ===');
  Object.keys(results).forEach(k => {
    console.log(`${k}: ${results[k].status}`);
  });
  
  const allPass = Object.values(results).every(r => r.status === 'PASS');
  process.exit(allPass ? 0 : 1);
}

runTests();
