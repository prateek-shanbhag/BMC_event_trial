const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

let db = null;
let auth = null;
let app = null;

try {
  // Prevent duplicate initialization in case of reloads
  if (getApps().length === 0) {
    let credential = null;
    let projectId = process.env.FIREBASE_PROJECT_ID;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!fs.existsSync(credPath)) {
        throw new Error(
          'Credential file specified in GOOGLE_APPLICATION_CREDENTIALS was not found. ' +
          'Please verify the file exists at the specified path outside the repository.'
        );
      }
      credential = applicationDefault();
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      let formattedKey = process.env.FIREBASE_PRIVATE_KEY;
      if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.slice(1, -1);
      }
      formattedKey = formattedKey.replace(/\\n/g, '\n');

      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      });
    } else if (process.env.K_SERVICE || process.env.GAE_ENV) {
      // In Google Cloud environments (Cloud Run / App Engine), attempt Application Default Credentials (ADC)
      credential = applicationDefault();
    } else {
      throw new Error(
        'Firebase Admin credentials not found.\n' +
        'For local development, set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of your service account key file outside the repository:\n' +
        '  GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"\n' +
        'For hosted environments (such as Render), configure secret environment variables:\n' +
        '  FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY'
      );
    }

    const appOptions = { credential };
    if (projectId) {
      appOptions.projectId = projectId;
    }

    app = initializeApp(appOptions);
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  // Cleanly log the startup error without exposing secret values or tokens
  console.error('ERROR: Failed to initialize Firebase Admin SDK.');
  console.error(error.message);
  throw error;
}

module.exports = {
  app,
  db,
  auth
};
