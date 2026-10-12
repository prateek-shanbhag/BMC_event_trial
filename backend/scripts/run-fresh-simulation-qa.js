const fetch = require('node-fetch');
const { db, app } = require('../config/firebaseAdmin');
const { getTestCredentials, loginTestUser, assertDestructiveOperationsAllowed } = require('./testSecurityGuard');

const API_BASE = 'http://localhost:5000/api';

const qaResults = {};
function report(part, status, detail = '') {
  qaResults[part] = { status, detail };
  console.log(`[${status}] ${part}${detail ? ' - ' + detail : ''}`);
}

async function runQA() {
  console.log('====================================================');
  console.log('STARTING FRESH-SIMULATION END-TO-END QA PASS');
  console.log('====================================================\n');

  const creds = getTestCredentials({ requireParticipant2: true });

  let adminToken, userTokenA, userTokenB;
  try {
    adminToken = await loginTestUser(creds.apiKey, creds.adminEmail, creds.adminPassword);
    userTokenA = await loginTestUser(creds.apiKey, creds.participantEmail, creds.participantPassword);
    userTokenB = await loginTestUser(creds.apiKey, creds.participant2Email, creds.participant2Password);
  } catch (err) {
    console.error('Authentication failure:', err.message);
    process.exit(1);
  }

  const req = async (path, method = 'GET', body = null, token = null) => {
    const opts = {
      method,
      headers: {}
    };
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data, ok: res.ok };
  };

  // ----------------------------------------------------
  // PART 1 — CLEAN TEST ENVIRONMENT
  // ----------------------------------------------------
  console.log('\n--- PART 1: CLEAN TEST ENVIRONMENT ---');
  try {
    // 1. Reset simulation config via Admin endpoint
    const resetRes = await req('/admin/simulation/reset', 'POST', null, adminToken);
    if (!resetRes.ok) throw new Error('Simulation reset endpoint failed: ' + resetRes.status);

    // 2. Clear portfolios, snapshots, allocations, assetValues
    const collectionsToClean = ['allocations', 'portfolios', 'portfolioSnapshots', 'assetValues'];
    const targetProjectId = app.options.projectId || db.projectId || process.env.FIREBASE_PROJECT_ID;
    assertDestructiveOperationsAllowed(collectionsToClean, targetProjectId);

    for (const col of collectionsToClean) {
      const snap = await db.collection(col).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // 3. Ensure test teams team_A and team_B exist and map correctly to users
    await db.collection('teams').doc('team_A').set({
      id: 'team_A',
      teamId: 'team_A',
      name: 'Team Alpha',
      memberUids: ['2SqvWQ0QdweOGZVptZb5Ik5VqSn1'],
      updatedAt: new Date().toISOString()
    });

    await db.collection('teams').doc('team_B').set({
      id: 'team_B',
      teamId: 'team_B',
      name: 'Team Beta',
      memberUids: ['FiHCEFbcpnhZoEsX994w9c6ooSC2'],
      updatedAt: new Date().toISOString()
    });

    // 4. Verify no active portfolios, snapshots, allocations
    const portSnap = await db.collection('portfolios').get();
    const snapSnap = await db.collection('portfolioSnapshots').get();
    const allocSnap = await db.collection('allocations').get();
    const cfgDoc = await db.collection('simulation').doc('config').get();
    const cfg = cfgDoc.data();

    if (portSnap.empty && snapSnap.empty && allocSnap.empty && cfg.status === 'SETUP' && cfg.currentRound === 0) {
      report('PART 1 — CLEAN TEST ENVIRONMENT', 'PASS', 'Clean database state initialized successfully');
    } else {
      report('PART 1 — CLEAN TEST ENVIRONMENT', 'FAIL', 'Found residual data or incorrect initial status');
    }
  } catch (err) {
    report('PART 1 — CLEAN TEST ENVIRONMENT', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 2 — ADMIN SETUP
  // ----------------------------------------------------
  console.log('\n--- PART 2: ADMIN SETUP ---');
  try {
    // 1. Check Admin simulation status
    const simRes = await req('/admin/simulation', 'GET', null, adminToken);
    const simStatusOk = simRes.ok && simRes.data.status === 'SETUP' && simRes.data.currentRound === 0;

    // 2. Check teams endpoint
    const teamsRes = await req('/admin/teams', 'GET', null, adminToken);
    const teamsOk = teamsRes.ok && Array.isArray(teamsRes.data.teams) && teamsRes.data.teams.length >= 2;

    // 3. Verify Asset Value Management does NOT allow Round 0
    const r0Save = await req('/admin/asset-values/0/1', 'PUT', { value: 100 }, adminToken);
    const r0Blocked = (r0Save.status === 400 || r0Save.status === 404 || r0Save.status === 403);

    // 4. Verify Asset Value Management allows Round 1 to 20
    const r1Test = await req('/admin/asset-values/1/1', 'PUT', { value: 100 }, adminToken);
    const r20Test = await req('/admin/asset-values/20/1', 'PUT', { value: 100 }, adminToken);
    const r1to20Ok = r1Test.ok && r20Test.ok;

    // Clean up temporary test asset values
    await db.collection('assetValues').doc('round_1_asset_1').delete();
    await db.collection('assetValues').doc('round_20_asset_1').delete();

    if (simStatusOk && teamsOk && r0Blocked && r1to20Ok) {
      report('PART 2 — ADMIN SETUP', 'PASS', 'Admin controls, teams, and round boundaries verified');
    } else {
      report('PART 2 — ADMIN SETUP', 'FAIL', `simStatus: ${simStatusOk}, teams: ${teamsOk}, r0Blocked: ${r0Blocked}, r1to20: ${r1to20Ok}`);
    }
  } catch (err) {
    report('PART 2 — ADMIN SETUP', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 3 — ROUND 0 INITIAL ALLOCATION
  // ----------------------------------------------------
  console.log('\n--- PART 3: ROUND 0 INITIAL ALLOCATION ---');
  try {
    // Start allocation phase
    const startAllocRes = await req('/admin/simulation/start-allocation', 'POST', null, adminToken);
    if (!startAllocRes.ok) throw new Error('Failed to start allocation: ' + startAllocRes.status);

    // Test rejection of negative or excessive allocation
    const negAlloc = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': -100, '2': 100, '3': 100, '4': 100, '5': 100, '6': 100, '7': 100 }
    }, userTokenA);
    const negRejected = (negAlloc.status === 400);

    const excessAlloc = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 2000000, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 }
    }, userTokenA);
    const excessRejected = (excessAlloc.status === 400);

    // Submit valid allocation for Team Alpha (Team A)
    // 1000 units of each of the 7 asset classes = ₹7,000 allocated, ₹993,000 cash
    const allocARes = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 1000, '2': 1000, '3': 1000, '4': 1000, '5': 1000, '6': 1000, '7': 1000 }
    }, userTokenA);

    // Submit valid allocation for Team Beta (Team B)
    // 2000 units of each of the 7 asset classes = ₹14,000 allocated, ₹986,000 cash
    const allocBRes = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 2000, '2': 2000, '3': 2000, '4': 2000, '5': 2000, '6': 2000, '7': 2000 }
    }, userTokenB);

    // Admin initializes portfolios
    const initPortRes = await req('/admin/portfolios/initialize', 'POST', null, adminToken);

    // Verify backend persistence and Round 0 snapshots
    const portADoc = await db.collection('portfolios').doc('team_team_A').get();
    const portBDoc = await db.collection('portfolios').doc('team_team_B').get();
    const snapA0Doc = await db.collection('portfolioSnapshots').doc('team_team_A_round_0').get();
    const snapB0Doc = await db.collection('portfolioSnapshots').doc('team_team_B_round_0').get();

    const bothPortsInit = portADoc.exists && portBDoc.exists;
    const bothSnapsInit = snapA0Doc.exists && snapB0Doc.exists;
    const holdingsCorrect = portADoc.data().holdings['1'] === 1000 && portBDoc.data().holdings['1'] === 2000;

    if (negRejected && excessRejected && allocARes.ok && allocBRes.ok && initPortRes.ok && bothPortsInit && bothSnapsInit && holdingsCorrect) {
      report('PART 3 — ROUND 0 INITIAL ALLOCATION', 'PASS', 'Validation, persistence, and Round 0 snapshots verified for all teams');
    } else {
      report('PART 3 — ROUND 0 INITIAL ALLOCATION', 'FAIL', `neg: ${negRejected}, excess: ${excessRejected}, allocA: ${allocARes.ok}, allocB: ${allocBRes.ok}, ports: ${bothPortsInit}, snaps: ${bothSnapsInit}`);
    }
  } catch (err) {
    report('PART 3 — ROUND 0 INITIAL ALLOCATION', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 4 — START ROUND 1
  // ----------------------------------------------------
  console.log('\n--- PART 4: START ROUND 1 ---');
  try {
    // Configure all 7 Round 1 asset values
    for (let ac = 1; ac <= 7; ac++) {
      const putRes = await req(`/admin/asset-values/1/${ac}`, 'PUT', { value: 100 + ac * 5 }, adminToken);
      if (!putRes.ok) throw new Error(`Failed to configure asset value for 1/${ac}`);
    }

    // Verify all 7 values exist in Firestore
    const r1ValsSnap = await db.collection('assetValues').where('round', '==', 1).get();
    const all7Exist = r1ValsSnap.size === 7;

    // Start Round 1
    const startR1Res = await req('/admin/simulation/start-round-1', 'POST', null, adminToken);
    const simCfgDoc = await db.collection('simulation').doc('config').get();
    const simCfg = simCfgDoc.data();

    if (all7Exist && startR1Res.ok && simCfg.currentRound === 1 && simCfg.status === 'RUNNING') {
      report('PART 4 — START ROUND 1', 'PASS', 'Round 1 started; currentRound=1, status=RUNNING');
    } else {
      report('PART 4 — START ROUND 1', 'FAIL', `all7Exist: ${all7Exist}, startR1: ${startR1Res.ok}, currentRound: ${simCfg.currentRound}, status: ${simCfg.status}`);
    }
  } catch (err) {
    report('PART 4 — START ROUND 1', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 5 — PARTICIPANT ROUND 1
  // ----------------------------------------------------
  console.log('\n--- PART 5: PARTICIPANT ROUND 1 ---');
  try {
    // Check participant simulation state
    const pStateA = await req('/participant/simulation-state', 'GET', null, userTokenA);
    const pStateB = await req('/participant/simulation-state', 'GET', null, userTokenB);
    const stateCorrect = pStateA.ok && pStateA.data.currentRound === 1 && pStateB.ok && pStateB.data.currentRound === 1;

    // Verify Participant CANNOT submit initial allocation in Round 1
    const allocInR1 = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 1000, '2': 1000, '3': 1000, '4': 1000, '5': 1000, '6': 1000, '7': 1000 }
    }, userTokenA);
    const allocBlocked = (allocInR1.status === 409 || allocInR1.status === 400);

    // Verify participant sees their own portfolio
    const portA = await req('/participant/portfolio', 'GET', null, userTokenA);
    const portB = await req('/participant/portfolio', 'GET', null, userTokenB);
    const ownPortfolioA = portA.ok && portA.data.teamId === 'team_A';
    const ownPortfolioB = portB.ok && portB.data.teamId === 'team_B';

    if (stateCorrect && allocBlocked && ownPortfolioA && ownPortfolioB) {
      report('PART 5 — PARTICIPANT ROUND 1', 'PASS', 'State propagation and allocation lockdown verified');
    } else {
      report('PART 5 — PARTICIPANT ROUND 1', 'FAIL', `state: ${stateCorrect}, allocBlocked: ${allocBlocked}, portA: ${ownPortfolioA}, portB: ${ownPortfolioB}`);
    }
  } catch (err) {
    report('PART 5 — PARTICIPANT ROUND 1', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 6 — ROUND 1 VALUATION
  // ----------------------------------------------------
  console.log('\n--- PART 6: ROUND 1 VALUATION ---');
  try {
    // Calculate Round 1 valuation for Team A
    const valARes = await req('/participant/portfolio/valuation/1', 'GET', null, userTokenA);
    const valA = valARes.data;

    // Verify Round 1 valuation for Team B via Admin endpoint
    const valBRes = await req('/admin/portfolios/team_B/valuation/1', 'GET', null, adminToken);
    const valB = valBRes.data;

    const valAOk = valARes.ok &&
      valA.assets && Object.keys(valA.assets).length === 7 &&
      typeof valA.cash === 'number' &&
      typeof (valA.totalInvestedValue ?? valA.investedValue) === 'number' &&
      typeof valA.totalPortfolioValue === 'number' &&
      typeof valA.profitLoss === 'number' &&
      typeof (valA.percentageReturn ?? valA.returnPercentage) === 'number';

    const valBOk = valBRes.ok &&
      valB.assets && Object.keys(valB.assets).length === 7 &&
      typeof valB.totalPortfolioValue === 'number';

    if (valAOk && valBOk) {
      report('PART 6 — ROUND 1 VALUATION', 'PASS', `Team A totalPortfolioValue: ₹${valA.totalPortfolioValue}, Team B totalPortfolioValue: ₹${valB.totalPortfolioValue}`);
    } else {
      report('PART 6 — ROUND 1 VALUATION', 'FAIL', `valAOk: ${valAOk}, valBOk: ${valBOk}`);
    }
  } catch (err) {
    report('PART 6 — ROUND 1 VALUATION', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 7 — ADVANCE ROUND 1 → 2
  // ----------------------------------------------------
  console.log('\n--- PART 7: ADVANCE ROUND 1 → 2 ---');
  try {
    // Save Team A active portfolio state before advance
    const pABefore = (await db.collection('portfolios').doc('team_team_A').get()).data();

    // Configure all 7 Round 2 asset values
    for (let ac = 1; ac <= 7; ac++) {
      await req(`/admin/asset-values/2/${ac}`, 'PUT', { value: 110 + ac * 5 }, adminToken);
    }

    // Admin advances round
    const advRes = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    const simCfg = (await db.collection('simulation').doc('config').get()).data();
    const roundIncremented = advRes.ok && simCfg.currentRound === 2;

    // Verify Round 1 snapshot exists for both teams (snapshot doc ID is `${teamId}_round_1`)
    const snapA1 = await db.collection('portfolioSnapshots').doc('team_A_round_1').get();
    const snapB1 = await db.collection('portfolioSnapshots').doc('team_B_round_1').get();
    const snapsExist = snapA1.exists && snapB1.exists;

    const snapAData = snapA1.data();
    const snapFieldsValid = snapAData && snapAData.round === 1 &&
      snapAData.holdings &&
      typeof snapAData.cash === 'number' &&
      typeof snapAData.investedValue === 'number' &&
      typeof snapAData.totalPortfolioValue === 'number';

    // Verify active portfolio holdings and cash remained unchanged
    const pAAfter = (await db.collection('portfolios').doc('team_team_A').get()).data();
    const holdingsUnchanged = JSON.stringify(pABefore.holdings) === JSON.stringify(pAAfter.holdings);
    const cashUnchanged = pABefore.cash === pAAfter.cash;

    if (roundIncremented && snapsExist && snapFieldsValid && holdingsUnchanged && cashUnchanged) {
      report('PART 7 — ADVANCE ROUND 1 → 2', 'PASS', 'Advanced to Round 2; Round 1 snapshots persisted; active portfolios preserved');
    } else {
      report('PART 7 — ADVANCE ROUND 1 → 2', 'FAIL', `roundInc: ${roundIncremented}, snaps: ${snapsExist}, fields: ${snapFieldsValid}, hold: ${holdingsUnchanged}, cash: ${cashUnchanged}`);
    }
  } catch (err) {
    report('PART 7 — ADVANCE ROUND 1 → 2', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 8 — HISTORY
  // ----------------------------------------------------
  console.log('\n--- PART 8: HISTORY ---');
  try {
    const histARes = await req('/participant/portfolio/history', 'GET', null, userTokenA);
    const histA = histARes.data.history;

    const r0Present = histA.some(h => h.round === 0);
    const r1Present = histA.some(h => h.round === 1);
    const r2Absent = !histA.some(h => h.round === 2); // Round 2 is currently ongoing, must NOT be in history

    // Verify snapshot values match persisted documents
    const docA1 = (await db.collection('portfolioSnapshots').doc('team_A_round_1').get()).data();
    const historyMatch = histA.find(h => h.round === 1).totalPortfolioValue === docA1.totalPortfolioValue;

    // Admin monitoring verification
    const adminHistRes = await req('/admin/portfolios/team_A/history', 'GET', null, adminToken);
    const adminOverviewRes = await req('/admin/portfolios', 'GET', null, adminToken);
    const adminMonitoringOk = adminHistRes.ok && adminOverviewRes.ok && adminOverviewRes.data.portfolios.length >= 2;

    if (r0Present && r1Present && r2Absent && historyMatch && adminMonitoringOk) {
      report('PART 8 — HISTORY', 'PASS', 'Participant and Admin historical snapshots verified with correct round visibility');
    } else {
      report('PART 8 — HISTORY', 'FAIL', `r0: ${r0Present}, r1: ${r1Present}, r2Absent: ${r2Absent}, match: ${historyMatch}, admin: ${adminMonitoringOk}`);
    }
  } catch (err) {
    report('PART 8 — HISTORY', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 9 — MULTI-ROUND PROGRESSION (ROUNDS 2 → 5)
  // ----------------------------------------------------
  console.log('\n--- PART 9: MULTI-ROUND PROGRESSION (2 → 5) ---');
  try {
    let multiRoundPass = true;

    for (let current = 2; current <= 5; current++) {
      const next = current + 1;
      // Configure asset values for next round
      for (let ac = 1; ac <= 7; ac++) {
        await req(`/admin/asset-values/${next}/${ac}`, 'PUT', { value: 100 + next * 5 }, adminToken);
      }

      const pBefore = (await db.collection('portfolios').doc('team_team_A').get()).data();
      const advRes = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
      const simCfg = (await db.collection('simulation').doc('config').get()).data();

      // Verify currentRound incremented
      if (!advRes.ok || simCfg.currentRound !== next) {
        multiRoundPass = false;
        console.error(`Advance ${current} -> ${next} failed.`);
      }

      // Verify previous round snapshot created
      const prevSnap = await db.collection('portfolioSnapshots').doc(`team_A_round_${current}`).get();
      if (!prevSnap.exists) {
        multiRoundPass = false;
        console.error(`Snapshot for round ${current} missing.`);
      }

      // Verify holdings & cash unchanged
      const pAfter = (await db.collection('portfolios').doc('team_team_A').get()).data();
      if (JSON.stringify(pBefore.holdings) !== JSON.stringify(pAfter.holdings) || pBefore.cash !== pAfter.cash) {
        multiRoundPass = false;
        console.error(`Holdings or cash changed during round ${current} -> ${next}.`);
      }

      // Verify participant sees new currentRound
      const pState = await req('/participant/simulation-state', 'GET', null, userTokenA);
      if (pState.data.currentRound !== next) {
        multiRoundPass = false;
        console.error(`Participant did not see new currentRound ${next}.`);
      }
    }

    if (multiRoundPass) {
      report('PART 9 — MULTI-ROUND PROGRESSION', 'PASS', 'Simulated progression through Rounds 2, 3, 4, 5 successfully verified');
    } else {
      report('PART 9 — MULTI-ROUND PROGRESSION', 'FAIL', 'One or more transitions failed checks');
    }
  } catch (err) {
    report('PART 9 — MULTI-ROUND PROGRESSION', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 10 — ROUND 20 BOUNDARY
  // ----------------------------------------------------
  console.log('\n--- PART 10: ROUND 20 BOUNDARY ---');
  try {
    // Current round is 6. Fast forward through round 20 by configuring asset values and advancing.
    for (let r = 6; r < 20; r++) {
      const nextR = r + 1;
      for (let ac = 1; ac <= 7; ac++) {
        await req(`/admin/asset-values/${nextR}/${ac}`, 'PUT', { value: 100 + nextR * 5 }, adminToken);
      }
      const adv = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
      if (!adv.ok) throw new Error(`Failed advancing to ${nextR}`);
    }

    const cfgAt20 = (await db.collection('simulation').doc('config').get()).data();
    const reached20 = (cfgAt20.currentRound === 20);

    // Attempt to advance beyond Round 20
    const advBeyond20 = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    const advBlocked = (advBeyond20.status === 409);
    const still20 = (await db.collection('simulation').doc('config').get()).data().currentRound === 20;

    if (reached20 && advBlocked && still20) {
      report('PART 10 — ROUND 20', 'PASS', 'Round 20 reached; advancement beyond Round 20 blocked (409)');
    } else {
      report('PART 10 — ROUND 20', 'FAIL', `reached20: ${reached20}, advBlocked: ${advBlocked}, still20: ${still20}`);
    }
  } catch (err) {
    report('PART 10 — ROUND 20', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 11 — FINISH SIMULATION
  // ----------------------------------------------------
  console.log('\n--- PART 11: FINISH SIMULATION ---');
  try {
    // Verify all 7 asset values for Round 20 exist
    const r20ValsSnap = await db.collection('assetValues').where('round', '==', 20).get();
    const r20Configured = (r20ValsSnap.size === 7);

    // Admin clicks Finish Simulation
    const finishRes = await req('/admin/simulation/finish', 'POST', null, adminToken);
    const finishOk = (finishRes.status === 200);

    const postFinishCfg = (await db.collection('simulation').doc('config').get()).data();
    const statusFinished = (postFinishCfg.status === 'FINISHED' && postFinishCfg.currentRound === 20);

    // Verify Round 20 final snapshots created for all teams
    const snapA20 = await db.collection('portfolioSnapshots').doc('team_A_round_20').get();
    const snapB20 = await db.collection('portfolioSnapshots').doc('team_B_round_20').get();
    const finalSnapsExist = snapA20.exists && snapB20.exists;

    if (r20Configured && finishOk && statusFinished && finalSnapsExist) {
      report('PART 11 — FINISH SIMULATION', 'PASS', 'Simulation successfully finished; final snapshots created for all teams');
    } else {
      report('PART 11 — FINISH SIMULATION', 'FAIL', `r20Configured: ${r20Configured}, finishOk: ${finishOk}, status: ${postFinishCfg?.status}, snaps: ${finalSnapsExist}`);
    }
  } catch (err) {
    report('PART 11 — FINISH SIMULATION', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 12 — POST-FINISH PARTICIPANT
  // ----------------------------------------------------
  console.log('\n--- PART 12: POST-FINISH PARTICIPANT ---');
  try {
    const pState = await req('/participant/simulation-state', 'GET', null, userTokenA);
    const pPort = await req('/participant/portfolio', 'GET', null, userTokenA);
    const pHist = await req('/participant/portfolio/history', 'GET', null, userTokenA);
    const pLeaderboard = await req('/participant/leaderboard', 'GET', null, userTokenA);

    const seesFinished = pState.ok && pState.data.status === 'FINISHED';
    const seesFinalPort = pPort.ok && pPort.data.teamId === 'team_A';
    const seesR20Snapshot = pHist.ok && pHist.data.history.some(h => h.round === 20);
    const seesLeaderboard = pLeaderboard.ok && Array.isArray(pLeaderboard.data.leaderboard);

    // Prohibited operations
    const allocAttempt = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 100, '2': 100, '3': 100, '4': 100, '5': 100, '6': 100, '7': 100 }
    }, userTokenA);
    const allocBlocked = (allocAttempt.status === 409 || allocAttempt.status === 400);

    const advAttempt = await req('/admin/simulation/advance-round', 'POST', null, userTokenA);
    const advBlocked = (advAttempt.status === 403);

    if (seesFinished && seesFinalPort && seesR20Snapshot && seesLeaderboard && allocBlocked && advBlocked) {
      report('PART 12 — POST-FINISH PARTICIPANT', 'PASS', 'Participant views final state and leaderboard; mutation attempts locked');
    } else {
      report('PART 12 — POST-FINISH PARTICIPANT', 'FAIL', `seesFin: ${seesFinished}, seesPort: ${seesFinalPort}, r20Snap: ${seesR20Snapshot}, lb: ${seesLeaderboard}, allocBlocked: ${allocBlocked}`);
    }
  } catch (err) {
    report('PART 12 — POST-FINISH PARTICIPANT', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 13 — POST-FINISH ADMIN
  // ----------------------------------------------------
  console.log('\n--- PART 13: POST-FINISH ADMIN ---');
  try {
    const adminSim = await req('/admin/simulation', 'GET', null, adminToken);
    const adminPorts = await req('/admin/portfolios', 'GET', null, adminToken);
    const adminLb = await req('/admin/leaderboard', 'GET', null, adminToken);

    const simFinished = adminSim.ok && adminSim.data.status === 'FINISHED' && adminSim.data.currentRound === 20;
    const allPortfoliosVisible = adminPorts.ok && adminPorts.data.portfolios.length >= 2;
    const lbVisible = adminLb.ok && adminLb.data.leaderboard.length >= 2;

    const advAttempt = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    const advBlocked = (advAttempt.status === 409);

    if (simFinished && allPortfoliosVisible && lbVisible && advBlocked) {
      report('PART 13 — POST-FINISH ADMIN', 'PASS', 'Admin dashboard displays finished state, portfolios, leaderboard, and blocks advancement');
    } else {
      report('PART 13 — POST-FINISH ADMIN', 'FAIL', `simFinished: ${simFinished}, ports: ${allPortfoliosVisible}, lb: ${lbVisible}, advBlocked: ${advBlocked}`);
    }
  } catch (err) {
    report('PART 13 — POST-FINISH ADMIN', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 14 — LEADERBOARD
  // ----------------------------------------------------
  console.log('\n--- PART 14: LEADERBOARD ---');
  try {
    const lbRes = await req('/admin/leaderboard', 'GET', null, adminToken);
    const lb = lbRes.data.leaderboard;

    // Verify sorted by totalPortfolioValue descending
    const sortedDesc = lb[0].totalPortfolioValue >= lb[1].totalPortfolioValue;
    const ranksAssigned = lb[0].rank === 1;

    // Check matches Round 20 snapshots
    const snapA20 = (await db.collection('portfolioSnapshots').doc('team_A_round_20').get()).data();
    const teamAEntry = lb.find(e => e.teamId === 'team_A');
    const snapMatch = teamAEntry && teamAEntry.totalPortfolioValue === snapA20.totalPortfolioValue;

    // Check participant view
    const pLbRes = await req('/participant/leaderboard', 'GET', null, userTokenA);
    const pTeamEntry = pLbRes.ok && Array.isArray(pLbRes.data.leaderboard) && pLbRes.data.leaderboard.find(e => e.teamId === 'team_A');
    const pLbOk = pTeamEntry && pTeamEntry.rank !== undefined;

    if (sortedDesc && ranksAssigned && snapMatch && pLbOk) {
      report('PART 14 — LEADERBOARD', 'PASS', `Rankings verified (Rank 1: ${lb[0].teamName} with ₹${lb[0].totalPortfolioValue})`);
    } else {
      report('PART 14 — LEADERBOARD', 'FAIL', `sortedDesc: ${sortedDesc}, ranks: ${ranksAssigned}, snapMatch: ${snapMatch}, pLbOk: ${pLbOk}`);
    }
  } catch (err) {
    report('PART 14 — LEADERBOARD', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 15 — SECURITY
  // ----------------------------------------------------
  console.log('\n--- PART 15: SECURITY ---');
  try {
    // 1. Participant attempts admin endpoint
    const pOnAdmin = await req('/admin/portfolios', 'GET', null, userTokenA);
    const pOnAdminBlocked = (pOnAdmin.status === 403);

    // 2. Admin attempts participant-only endpoint
    const adminOnP = await req('/participant/portfolio', 'GET', null, adminToken);
    const adminOnPBlocked = (adminOnP.status === 403);

    // 3. Participant attempts simulation state modification
    const pSimMod = await req('/admin/simulation/reset', 'POST', null, userTokenA);
    const pSimModBlocked = (pSimMod.status === 403);

    // 4. Missing or invalid token
    const invalidTokenRes = await req('/admin/simulation', 'GET', null, 'bad_token');
    const invalidBlocked = (invalidTokenRes.status === 401 || invalidTokenRes.status === 403);

    const noTokenRes = await req('/admin/simulation', 'GET', null, null);
    const noTokenBlocked = (noTokenRes.status === 401 || noTokenRes.status === 403);

    if (pOnAdminBlocked && adminOnPBlocked && pSimModBlocked && invalidBlocked && noTokenBlocked) {
      report('PART 15 — SECURITY', 'PASS', 'All unauthorized operations strictly rejected with 401/403');
    } else {
      report('PART 15 — SECURITY', 'FAIL', `pOnAdmin: ${pOnAdminBlocked}, adminOnP: ${adminOnPBlocked}, pSimMod: ${pSimModBlocked}, invalid: ${invalidBlocked}`);
    }
  } catch (err) {
    report('PART 15 — SECURITY', 'FAIL', err.message);
  }

  // ----------------------------------------------------
  // PART 16 — FAILURE-SAFETY TESTS
  // ----------------------------------------------------
  console.log('\n--- PART 16: FAILURE-SAFETY TESTS ---');
  try {
    // 1. Duplicate finish attempt on already FINISHED simulation
    const dupFinish = await req('/admin/simulation/finish', 'POST', null, adminToken);
    const dupFinishRejected = (dupFinish.status === 409);

    // 2. Advance attempt on FINISHED simulation
    const advFinished = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    const advFinishedRejected = (advFinished.status === 409);

    // 3. Premature finish test (temporarily set round to 15 in RUNNING state)
    await db.collection('simulation').doc('config').update({ status: 'RUNNING', currentRound: 15 });
    const prematureFinish = await req('/admin/simulation/finish', 'POST', null, adminToken);
    const prematureFinishRejected = (prematureFinish.status === 409);

    // 4. Missing asset value on advance
    // Set current round to 18. Delete round 18 asset 7.
    await db.collection('simulation').doc('config').update({ status: 'RUNNING', currentRound: 18 });
    const r18a7 = await db.collection('assetValues').doc('round_18_asset_7').get();
    const r18a7Val = r18a7.data().value;
    await db.collection('assetValues').doc('round_18_asset_7').delete();

    const advMissingAsset = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    const advMissingRejected = (advMissingAsset.status === 409);
    const roundUnchanged = (await db.collection('simulation').doc('config').get()).data().currentRound === 18;

    // Restore missing asset value
    await req('/admin/asset-values/18/7', 'PUT', { value: r18a7Val }, adminToken);

    // Advance 18 -> 19 -> 20
    await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    await req('/admin/simulation/advance-round', 'POST', null, adminToken);

    // 5. Missing Round 20 asset value on finish
    const r20a7 = await db.collection('assetValues').doc('round_20_asset_7').get();
    const r20a7Val = r20a7.data().value;
    await db.collection('assetValues').doc('round_20_asset_7').delete();

    const finishMissingAsset = await req('/admin/simulation/finish', 'POST', null, adminToken);
    const finishMissingRejected = (finishMissingAsset.status === 409);
    const simRemainsRunning = (await db.collection('simulation').doc('config').get()).data().status === 'RUNNING';

    // Restore and finalize cleanly
    await req('/admin/asset-values/20/7', 'PUT', { value: r20a7Val }, adminToken);
    await req('/admin/simulation/finish', 'POST', null, adminToken);

    if (dupFinishRejected && advFinishedRejected && prematureFinishRejected && advMissingRejected && roundUnchanged && finishMissingRejected && simRemainsRunning) {
      report('PART 16 — FAILURE-SAFETY TESTS', 'PASS', 'Missing values, duplicate transitions, and premature finish rejected cleanly with 409');
    } else {
      report('PART 16 — FAILURE-SAFETY TESTS', 'FAIL', `dupFin: ${dupFinishRejected}, advFin: ${advFinishedRejected}, premFin: ${prematureFinishRejected}, advMiss: ${advMissingRejected}, finMiss: ${finishMissingRejected}`);
    }
  } catch (err) {
    report('PART 16 — FAILURE-SAFETY TESTS', 'FAIL', err.message);
  }

  console.log('\n====================================================');
  console.log('SUMMARY OF E2E QA RESULTS');
  console.log('====================================================');
  let allPassed = true;
  for (const [part, res] of Object.entries(qaResults)) {
    console.log(`${part}: ${res.status} ${res.detail ? '(' + res.detail + ')' : ''}`);
    if (res.status !== 'PASS') allPassed = false;
  }

  process.exit(allPassed ? 0 : 1);
}

runQA();
