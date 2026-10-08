const fetch = require('node-fetch');
const { db } = require('../config/firebaseAdmin');

const API_KEY = 'AIzaSyCoUgT8Ps-EYoS-XAR3-hW906kdNc9LX_M';
const API_BASE = 'http://localhost:5000/api';

async function login(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const data = await res.json();
  return data.idToken;
}

const results = {};
function report(section, status, reason = null) {
  results[section] = { status, reason };
  console.log(`[${status}] ${section}` + (reason ? `: ${reason}` : ''));
}

async function runTests() {
  let adminToken, userToken;
  try {
    adminToken = await login('admin@gmail.com', 'password');
    userToken = await login('hello@gmail.com', 'password');
  } catch (e) {
    console.error('Failed to login:', e);
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
    // Reset DB
    await req('/admin/simulation/reset', 'POST', null, adminToken);
    
    // Clear collections
    const collections = ['allocations', 'portfolios', 'portfolioSnapshots', 'assetValues'];
    for (const c of collections) {
      const docs = await db.collection(c).get();
      const batch = db.batch();
      docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    console.log("DB cleaned.");

    // Start allocation
    await req('/admin/simulation/start-allocation', 'POST', null, adminToken);
    
    // Allocate
    await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: { '1': 100, '2': 100, '3': 100, '4': 100, '5': 100, '6': 100, '7': 100 }
    }, userToken);
    
    // Init portfolios
    await req('/admin/portfolios/initialize', 'POST', null, adminToken);
    
    // Helper to set asset values using API
    async function setAssetValues(round, skipOne = false) {
      for (let i = 1; i <= 7; i++) {
        if (skipOne && i === 7) continue;
        await req(`/admin/asset-values/${round}/${i}`, 'PUT', { value: 100 + round * 10 }, adminToken);
      }
    }

    // Set round 1 values
    await setAssetValues(1);
    
    // Start Round 1
    await req('/admin/simulation/start-round-1', 'POST', null, adminToken);
    
    // Fast forward to Round 19
    for (let r = 1; r < 19; r++) {
      await setAssetValues(r + 1); // Set for the next round before advancing
      await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    }
    
    // Test 1: Attempt to finish at Round 19
    let res1 = await req('/admin/simulation/finish', 'POST', null, adminToken);
    if (res1.status === 409) {
      report('Test 1: Attempt to finish at Round 19 (409)', 'PASS');
    } else {
      report('Test 1: Attempt to finish at Round 19 (409)', 'FAIL', `status ${res1.status}`);
    }

    // Advance to Round 20
    await setAssetValues(20);
    await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    
    let simState = await req('/admin/simulation', 'GET', null, adminToken);
    if (simState.data.currentRound === 20) {
      report('Test 2: Move to Round 20 (valid)', 'PASS');
    } else {
      report('Test 2: Move to Round 20 (valid)', 'FAIL', `round is ${simState.data.currentRound}`);
    }

    // Test 6: Remove one Round 20 asset value. Attempt to finish (409)
    await db.collection('assetValues').doc('round_20_asset_7').delete();
    let res6 = await req('/admin/simulation/finish', 'POST', null, adminToken);
    if (res6.status === 409) {
      report('Test 6: Finish with missing asset values (409)', 'PASS');
    } else {
      report('Test 6: Finish with missing asset values (409)', 'FAIL', `status ${res6.status}`);
    }

    // Get portfolios before finishing
    const ptUserDoc = await db.collection('users').where('email', '==', 'hello@gmail.com').limit(1).get();
    const teamId = ptUserDoc.docs[0].data().teamId;
    const portfolioBefore = await db.collection('portfolios').doc(`team_${teamId}`).get();

    // Test 3: Finish simulation at Round 20
    await req(`/admin/asset-values/20/7`, 'PUT', { value: 300 }, adminToken); // restore
    let res3 = await req('/admin/simulation/finish', 'POST', null, adminToken);
    if (res3.status === 200) {
      report('Test 3: Finish simulation at Round 20', 'PASS');
    } else {
      report('Test 3: Finish simulation at Round 20', 'FAIL', `status ${res3.status} ${JSON.stringify(res3.data)}`);
    }

    // Test 4: Verify every active team's Round 20 snapshot
    const snap = await db.collection('portfolioSnapshots').doc(`${teamId}_round_20`).get();
    if (snap.exists && snap.data().investedValue !== undefined && snap.data().totalPortfolioValue !== undefined) {
      report('Test 4: Verify Round 20 snapshot', 'PASS');
    } else {
      report('Test 4: Verify Round 20 snapshot', 'FAIL');
    }

    // Test 5: Verify active portfolios were NOT mutated
    const portfolioAfter = await db.collection('portfolios').doc(`team_${teamId}`).get();
    if (JSON.stringify(portfolioBefore.data().holdings) === JSON.stringify(portfolioAfter.data().holdings) &&
        portfolioBefore.data().cash === portfolioAfter.data().cash) {
      report('Test 5: Verify active portfolios NOT mutated', 'PASS');
    } else {
      report('Test 5: Verify active portfolios NOT mutated', 'FAIL');
    }

    // Test 7: Attempt to finish an already FINISHED simulation
    let res7 = await req('/admin/simulation/finish', 'POST', null, adminToken);
    if (res7.status === 409) {
      report('Test 7: Attempt to finish FINISHED simulation', 'PASS');
    } else {
      report('Test 7: Attempt to finish FINISHED simulation', 'FAIL', `status ${res7.status}`);
    }

    // Test 8: Attempt to advance after FINISHED
    let res8 = await req('/admin/simulation/advance-round', 'POST', null, adminToken);
    if (res8.status === 409) {
      report('Test 8: Attempt to advance after FINISHED', 'PASS');
    } else {
      report('Test 8: Attempt to advance after FINISHED', 'FAIL', `status ${res8.status}`);
    }

    // Test 9: Participant behavior after FINISHED
    let pState = await req('/participant/simulation-state', 'GET', null, userToken);
    let pPort = await req('/participant/portfolio', 'GET', null, userToken);
    let pHist = await req('/participant/portfolio/history', 'GET', null, userToken);
    let pAlloc = await req('/participant/allocation/submit', 'POST', { 
      round: 0, 
      allocations: { '1': 100, '2': 100, '3': 100, '4': 100, '5': 100, '6': 100, '7': 100 }
    }, userToken);
    
    if (pState.data.status === 'FINISHED' && pPort.status === 200 && pHist.status === 200 && (pAlloc.status === 409 || pAlloc.status === 400)) {
      report('Test 9: Participant behavior after FINISHED', 'PASS');
    } else {
      report('Test 9: Participant behavior after FINISHED', 'FAIL', `Alloc status: ${pAlloc.status}`);
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
