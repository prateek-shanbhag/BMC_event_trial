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
    return { status: res.status, data };
  };

  try {
    // We assume the DB is already populated by previous tests. If not, this might fail on empty data, but basic API checks should pass.
    
    // Find the participant's teamId
    const ptUserDoc = await db.collection('users').where('email', '==', 'hello@gmail.com').limit(1).get();
    const teamId = ptUserDoc.docs[0].data().teamId;

    // Test 1: Admin can retrieve all active team portfolios.
    let res1 = await req('/admin/portfolios', 'GET', null, adminToken);
    if (res1.status === 200 && Array.isArray(res1.data.portfolios)) {
      report('Test 1: Admin can retrieve all active team portfolios', 'PASS');
    } else {
      report('Test 1: Admin can retrieve all active team portfolios', 'FAIL', `status ${res1.status}`);
    }

    // Test 2: Participant receives 403 when attempting the Admin portfolio overview endpoint.
    let res2 = await req('/admin/portfolios', 'GET', null, userToken);
    if (res2.status === 403) {
      report('Test 2: Participant receives 403 when attempting the Admin portfolio overview endpoint', 'PASS');
    } else {
      report('Test 2: Participant receives 403 when attempting the Admin portfolio overview endpoint', 'FAIL', `status ${res2.status}`);
    }

    // Test 3: Admin can retrieve a specific team's valuation for Round 1.
    let res3 = await req(`/admin/portfolios/${teamId}/valuation/1`, 'GET', null, adminToken);
    if (res3.status === 200 && res3.data.totalPortfolioValue !== undefined) {
      report(`Test 3: Admin can retrieve a specific team's valuation for Round 1`, 'PASS');
    } else {
      report(`Test 3: Admin can retrieve a specific team's valuation for Round 1`, 'FAIL', `status ${res3.status}`);
    }

    // Test 4: Admin cannot calculate Round 0 valuation.
    let res4 = await req(`/admin/portfolios/${teamId}/valuation/0`, 'GET', null, adminToken);
    if (res4.status === 400) {
      report('Test 4: Admin cannot calculate Round 0 valuation', 'PASS');
    } else {
      report('Test 4: Admin cannot calculate Round 0 valuation', 'FAIL', `status ${res4.status}`);
    }

    // Test 5: Admin can retrieve a team's historical snapshots.
    let res5 = await req(`/admin/portfolios/${teamId}/history`, 'GET', null, adminToken);
    if (res5.status === 200 && Array.isArray(res5.data.history)) {
      report(`Test 5: Admin can retrieve a team's historical snapshots`, 'PASS');
    } else {
      report(`Test 5: Admin can retrieve a team's historical snapshots`, 'FAIL', `status ${res5.status}`);
    }

    // Test 6: Historical values exactly match stored portfolioSnapshots.
    if (res5.status === 200 && res5.data.history.length > 0) {
      const snapFromApi = res5.data.history[0];
      const snapDoc = await db.collection('portfolioSnapshots').doc(`team_${teamId}_round_${snapFromApi.round}`).get();
      if (snapDoc.exists && snapDoc.data().totalPortfolioValue === snapFromApi.totalPortfolioValue) {
        report('Test 6: Historical values exactly match stored portfolioSnapshots', 'PASS');
      } else {
        report('Test 6: Historical values exactly match stored portfolioSnapshots', 'FAIL', 'Data mismatch');
      }
    } else {
      report('Test 6: Historical values exactly match stored portfolioSnapshots', 'FAIL', 'No history found');
    }

    // Test 7: Missing Round N asset value returns the existing 409 behavior.
    // Try round 19 (should have no asset values configured)
    let res7 = await req(`/admin/portfolios/${teamId}/valuation/19`, 'GET', null, adminToken);
    if (res7.status === 409) {
      report('Test 7: Missing Round N asset value returns the existing 409 behavior', 'PASS');
    } else {
      report('Test 7: Missing Round N asset value returns the existing 409 behavior', 'FAIL', `status ${res7.status}`);
    }

    // Test 8: Existing participant portfolio/history APIs still work.
    let res8a = await req('/participant/portfolio', 'GET', null, userToken);
    let res8b = await req('/participant/portfolio/history', 'GET', null, userToken);
    if (res8a.status === 200 && res8b.status === 200) {
      report('Test 8: Existing participant portfolio/history APIs still work', 'PASS');
    } else {
      report('Test 8: Existing participant portfolio/history APIs still work', 'FAIL', `statuses ${res8a.status}, ${res8b.status}`);
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
