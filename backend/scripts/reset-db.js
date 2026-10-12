const { db, app } = require('../config/firebaseAdmin');
const { assertDestructiveOperationsAllowed } = require('./testSecurityGuard');

async function clean() {
  const collections = ['allocations', 'portfolios', 'portfolioSnapshots'];
  const targetProjectId = app.options.projectId || db.projectId || process.env.FIREBASE_PROJECT_ID;

  assertDestructiveOperationsAllowed(collections, targetProjectId);

  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Cleaned collection: ${col}`);
  }
}

clean().then(() => process.exit(0)).catch(err => {
  console.error('Error in reset-db:', err.message);
  process.exit(1);
});
