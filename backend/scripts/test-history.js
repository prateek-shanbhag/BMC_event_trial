const admin = require('firebase-admin');
const fs = require('fs');
const fetch = require('node-fetch');

// initialize admin
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function runTest() {
  try {
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').where('role', '==', 'participant').limit(1).get();
    
    if (usersSnapshot.empty) {
      console.log('No participant users found.');
      return;
    }
    
    const user = usersSnapshot.docs[0].data();
    console.log(`Found participant user: ${user.email} (teamId: ${user.teamId})`);
    
    const snapshotsRef = db.collection('portfolioSnapshots');
    const snapshotDocs = await snapshotsRef
      .where('teamId', '==', user.teamId)
      .orderBy('round', 'asc')
      .get();
      
    console.log(`Found ${snapshotDocs.size} snapshots for team ${user.teamId}`);
    snapshotDocs.forEach(doc => {
      console.log(`Round: ${doc.data().round}, Invested: ${doc.data().investedValue}, P/L: ${doc.data().profitLoss}`);
    });
    
    console.log('✅ DB query successful, matching endpoint logic.');
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    process.exit(0);
  }
}

runTest();
