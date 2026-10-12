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
    return fetch(API_BASE + path, opts);
  };

  // Pre-requisite: Reset Simulation to SETUP, then to ALLOCATION
  await req('/admin/simulation/reset', 'POST', null, adminToken);
  
  // Clear allocations, portfolios, snapshots, assetValues for a clean test slate
  const collectionsToClear = ['allocations', 'portfolios', 'portfolioSnapshots', 'assetValues'];
  const targetProjectId = app.options.projectId || db.projectId || process.env.FIREBASE_PROJECT_ID;
  assertDestructiveOperationsAllowed(collectionsToClear, targetProjectId);

  for (const coll of collectionsToClear) {
    const snap = await db.collection(coll).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  await req('/admin/simulation/start-allocation', 'POST', null, adminToken);

  // 1. Asset Value Management
  try {
    const assetClasses = ['1', '2', '3', '4', '5', '6', '7'];
    let allSaved = true;
    for(let ac of assetClasses) {
      const res = await req(`/admin/asset-values/1/${ac}`, 'PUT', { value: 100 }, adminToken);
      if (!res.ok) allSaved = false;
    }
    
    // Check Round 0 is rejected
    const res0 = await req(`/admin/asset-values/0/1`, 'PUT', { value: 100 }, adminToken);
    
    if (allSaved && (res0.status === 400 || res0.status === 403 || res0.status === 404)) {
      report('Section 1: Asset Value Management', 'PASS');
    } else {
      report('Section 1: Asset Value Management', 'FAIL', `R1 Save All: ${allSaved}, R0 Save Status: ${res0.status}`);
    }
  } catch(e) { report('Section 1', 'FAIL', e.message); }

  // 2. Round 0 Initial Allocation
  try {
    const res = await req('/participant/allocation/submit', 'POST', {
      round: 0,
      allocations: {
        "1": 1000, "2": 1000, "3": 1000, "4": 1000, "5": 1000, "6": 1000, "7": 1000
      }
    }, userToken);
    
    if (res.ok) report('Section 2: Round 0 Initial Allocation', 'PASS');
    else {
      const err = await res.text();
      report('Section 2: Round 0 Initial Allocation', 'FAIL', `Status ${res.status}: ${err}`);
    }
  } catch(e) { report('Section 2', 'FAIL', e.message); }

  // 3. Admin Initialize Portfolios and Round 1
  try {
    const initRes = await req('/admin/portfolios/initialize', 'POST', null, adminToken);
    if (!initRes.ok) throw new Error('Portfolios init failed: ' + await initRes.text());
    
    const res = await req('/admin/simulation/start-round-1', 'POST', null, adminToken);
    if (res.ok) report('Section 3: Admin Initialize Round 1', 'PASS');
    else report('Section 3: Admin Initialize Round 1', 'FAIL', await res.text());
  } catch(e) { report('Section 3', 'FAIL', e.message); }

  // 4. Participant Round 1 Propagation
  try {
    const res = await req('/participant/simulation-state', 'GET', null, userToken);
    const data = await res.json();
    if (res.ok && data.currentRound === 1) report('Section 4: Participant Round 1 Propagation', 'PASS');
    else report('Section 4: Participant Round 1 Propagation', 'FAIL', `Status: ${res.status}, data: ${JSON.stringify(data)}`);
  } catch(e) { report('Section 4', 'FAIL', e.message); }

  // 5. Participant Allocation Submission for Round 1
  try {
    // Round 1 is NOT allocation round
    const res = await req('/participant/allocation/submit', 'POST', {
      round: 1,
      allocations: {
        "1": 2000, "2": 2000, "3": 2000, "4": 2000, "5": 2000, "6": 2000, "7": 2000
      }
    }, userToken);
    if (res.ok) report('Section 5: Participant Allocation Submission (Round 1 should fail)', 'FAIL', 'Expected 4xx due to round 1 not accepting allocations via this API.');
    else {
      const err = await res.text();
      report('Section 5: Participant Allocation Submission (Round 1 correctly blocked)', 'PASS', `Status ${res.status}: ${err}`);
    }
  } catch(e) { report('Section 5', 'FAIL', e.message); }

  // 6. Security
  try {
    const res = await req('/admin/simulation/advance-round', 'POST', null, userToken);
    if (res.status === 403) report('Section 6: Security', 'PASS');
    else report('Section 6: Security', 'FAIL', `User was able to call admin endpoint, status: ${res.status}`);
  } catch(e) { report('Section 6', 'FAIL', e.message); }

  // 7. Round 0 Valuation
  try {
    const res = await req('/participant/portfolio/valuation/0', 'GET', null, userToken);
    if (!res.ok && (res.status === 400 || res.status === 404)) report('Section 7: Round 0 Valuation', 'PASS');
    else report('Section 7: Round 0 Valuation', 'FAIL', `Valuation for R0 was permitted or unhandled: status ${res.status}`);
  } catch(e) { report('Section 7', 'FAIL', e.message); }

  // 8. Round 1 Valuation Regression
  try {
    const res = await req('/participant/portfolio/valuation/1', 'GET', null, userToken);
    if (res.ok) {
      const data = await res.json();
      if (data.totalPortfolioValue !== undefined && data.assets && Object.keys(data.assets).length === 7) {
        report('Section 8: Round 1 Valuation Regression', 'PASS');
      } else {
        report('Section 8: Round 1 Valuation Regression', 'FAIL', `Missing fields in JSON: ${JSON.stringify(data).slice(0, 50)}`);
      }
    } else {
      const err = await res.text();
      report('Section 8: Round 1 Valuation Regression', 'FAIL', `Status ${res.status}: ${err}`);
    }
  } catch(e) { report('Section 8', 'FAIL', e.message); }

  console.log("\n=== FINAL REPORT ===");
  Object.keys(results).forEach(k => {
    console.log(`${k}: ${results[k].status}` + (results[k].reason ? ` -> ${results[k].reason}` : ''));
  });
}

runTests();
