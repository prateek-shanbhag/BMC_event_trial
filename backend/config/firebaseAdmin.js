const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

let db = null;
let auth = null;
let app = null;

try {
  // Prevent duplicate initialization in case of reloads
  if (getApps().length === 0) {
    let projectId = process.env.FIREBASE_PROJECT_ID;

    // First try checking if the explicit credential JSON file exists
    const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      credential = cert(serviceAccount);
      projectId = serviceAccount.project_id;
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      // Fallback to environment variables
      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      throw new Error('Firebase Admin credentials not found in file or environment variables.');
    }

    app = initializeApp({
      credential,
      projectId: projectId,
    });
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  // The server must not pretend Firebase is working if this fails.
  // We throw the error here so the Node process crashes cleanly during startup.
  console.error('ERROR: Failed to initialize Firebase Admin SDK.');
  throw new Error(error.message);
}

module.exports = {
  app,
  db,
  auth
};
