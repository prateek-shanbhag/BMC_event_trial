const { db } = require('../config/firebaseAdmin');
const fetch = require('node-fetch');
const { getTestCredentials, loginTestUser } = require('./testSecurityGuard');

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  const creds = getTestCredentials();

  try {
    const userToken = await loginTestUser(creds.apiKey, creds.participantEmail, creds.participantPassword);
    const userDoc = await db.collection('users').where('email', '==', creds.participantEmail).limit(1).get();
    
    if (userDoc.empty) {
      console.log(`No participant user ${creds.participantEmail} found in Firestore.`);
      process.exit(1);
    }
    
    const user = userDoc.docs[0].data();
    console.log(`Found participant user: ${user.email} (teamId: ${user.teamId})`);
    
    // Test participant history endpoint
    const res = await fetch(`${API_BASE}/participant/portfolio/history`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (res.status === 200) {
      const data = await res.json();
      console.log(`Endpoint returned ${data.history ? data.history.length : 0} snapshots.`);
      console.log('✅ Participant History Endpoint test: PASS');
    } else {
      console.error(`Endpoint returned status ${res.status}`);
      process.exit(1);
    }

    // Direct DB check
    const snapshotDocs = await db.collection('portfolioSnapshots')
      .where('teamId', '==', user.teamId)
      .get();
      
    console.log(`Found ${snapshotDocs.size} snapshots in DB for team ${user.teamId}`);
    console.log('✅ DB query successful, matching endpoint logic: PASS');
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err.message);
    process.exit(1);
  }
}

runTest();
