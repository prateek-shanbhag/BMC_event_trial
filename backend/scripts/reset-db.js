require('dotenv').config({ path: '../.env' });
const { db } = require('../config/firebaseAdmin');

async function clean() {
  const collections = ['allocations', 'portfolios', 'portfolioSnapshots'];
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

clean().then(() => process.exit(0)).catch(console.error);
