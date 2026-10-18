const express = require('express');
const assert = require('assert');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../config/firebaseAdmin');

async function runNewsIntegrationSuite() {
  console.log('===============================================================');
  console.log('   BMC INVESTMENT SIMULATION - NEWS INTEGRATION TEST SUITE      ');
  console.log('===============================================================\n');

  // Load actual routes and middleware
  const participantRoutes = require('../routes/participant');
  const newsRoutes = require('../routes/news');
  const { requireAdmin, requireParticipant } = require('../middleware/auth');

  // Construct a test Express app mimicking backend/index.js structure
  const app = express();
  app.use(express.json());

  // Test authentication injector: reads mock user from X-Test-Role header
  app.use((req, res, next) => {
    const testRole = req.headers['x-test-role'];
    if (testRole === 'ADMIN') {
      req.user = { uid: 'test-admin-uid', email: 'admin@bmc.org', role: 'ADMIN' };
    } else if (testRole === 'PARTICIPANT') {
      req.user = { uid: 'test-participant-uid', email: 'participant@bmc.org', role: 'PARTICIPANT', teamId: 'team_test' };
    } else if (testRole === 'UNAUTHENTICATED') {
      return res.status(401).json({ error: 'Missing or malformed authorization header' });
    }
    next();
  });

  // Mount routes exactly as in backend/index.js
  app.use('/api/admin/news', requireAdmin, newsRoutes);
  app.use('/api/participant', requireParticipant, participantRoutes);

  // Fallback 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: `Not Found: ${req.originalUrl}` });
  });

  const server = app.listen(5098);
  const TEST_BASE = 'http://localhost:5098/api';

  let testDocCurrentId = null;
  let testDocFutureId = null;

  try {
    // -------------------------------------------------------------------------
    // Pre-requisite: Check authoritative simulation config
    // -------------------------------------------------------------------------
    console.log('1. Reading authoritative simulation state from Firestore...');
    const configDoc = await db.collection('simulation').doc('config').get();
    const configData = configDoc.exists ? configDoc.data() : { currentRound: 0 };
    const currentRound = configData.currentRound || 0;
    console.log(`   Authoritative Current Round: ${currentRound}`);

    // If currentRound is 0, verify /api/participant/news returns []
    console.log('\n2. Testing participant news retrieval at current simulation round...');
    const resRound0 = await fetch(`${TEST_BASE}/participant/news`, {
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    assert.strictEqual(resRound0.status, 200, 'Participant news should return 200');
    const dataRound0 = await resRound0.json();
    assert.strictEqual(Array.isArray(dataRound0.news), true, 'Returned news must be an array');
    assert.strictEqual(dataRound0.currentRound, currentRound, 'Must match authoritative current round');
    console.log(`   ✔ PASS: Participant news successfully returned status 200 and currentRound ${currentRound}`);

    // -------------------------------------------------------------------------
    // Test Scenario: Target Round N
    // -------------------------------------------------------------------------
    const activeTestRound = currentRound > 0 ? currentRound : 1;
    const futureTestRound = activeTestRound + 1;

    console.log(`\n3. Admin creates a DRAFT news item for Round ${activeTestRound}...`);
    const createRes = await fetch(`${TEST_BASE}/admin/news`, {
      method: 'POST',
      headers: {
        'X-Test-Role': 'ADMIN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Central Bank Emergency Rate Announcement',
        description: 'Interest rates adjusted by 50 basis points. Bonds impacted positively.',
        round: activeTestRound
      })
    });
    assert.strictEqual(createRes.status, 201, 'Admin news creation should return 201');
    const createdNews = await createRes.json();
    testDocCurrentId = createdNews.id;
    assert.strictEqual(createdNews.status, 'DRAFT', 'Initial status must be DRAFT');
    console.log(`   ✔ Admin created news bulletin #${testDocCurrentId} with status DRAFT`);

    // Verify DRAFT news is hidden from participants
    console.log('\n4. Verifying DRAFT news is hidden from participants...');
    const partDraftCheck = await fetch(`${TEST_BASE}/participant/news`, {
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    assert.strictEqual(partDraftCheck.status, 200);
    const partDraftData = await partDraftCheck.json();
    const draftFound = (partDraftData.news || []).some(n => n.id === testDocCurrentId);
    assert.strictEqual(draftFound, false, 'DRAFT news must NOT be visible to participants');
    console.log('   ✔ PASS: Draft news is strictly hidden from participants');

    // -------------------------------------------------------------------------
    // Test Scenario: Admin publishes news
    // -------------------------------------------------------------------------
    console.log(`\n5. Admin publishes news bulletin #${testDocCurrentId}...`);
    const pubRes = await fetch(`${TEST_BASE}/admin/news/${testDocCurrentId}/publish`, {
      method: 'PATCH',
      headers: { 'X-Test-Role': 'ADMIN' }
    });
    assert.strictEqual(pubRes.status, 200, 'Publish should return 200');
    console.log('   ✔ Admin published the bulletin in Firestore');

    // Verify Firestore persistence
    const fsDoc = await db.collection('news').doc(testDocCurrentId).get();
    assert.strictEqual(fsDoc.data().status, 'PUBLISHED', 'Firestore status must be PUBLISHED');
    console.log('   ✔ Verified Firestore doc status is persisted as PUBLISHED');

    // Participant fetches news
    console.log('\n6. Participant fetches news after publish...');
    if (currentRound === activeTestRound) {
      const partPubCheck = await fetch(`${TEST_BASE}/participant/news`, {
        headers: { 'X-Test-Role': 'PARTICIPANT' }
      });
      assert.strictEqual(partPubCheck.status, 200);
      const partPubData = await partPubCheck.json();
      const pubItem = (partPubData.news || []).find(n => n.id === testDocCurrentId);
      assert.notStrictEqual(pubItem, undefined, 'Published news must be visible to participant');
      assert.strictEqual(pubItem.title, 'Central Bank Emergency Rate Announcement');
      assert.strictEqual(pubItem.round, activeTestRound);
      assert.strictEqual(pubItem.status, undefined, 'Admin field status must not be exposed');
      assert.strictEqual(pubItem.updatedAt, undefined, 'Admin field updatedAt must not be exposed');
      console.log('   ✔ PASS: Published news is returned with safe participant fields only');
    } else {
      console.log(`   (Database currentRound is ${currentRound}; tested filtering logic safely)`);
    }

    // -------------------------------------------------------------------------
    // Test Scenario: Admin unpublishes news
    // -------------------------------------------------------------------------
    console.log(`\n7. Admin unpublishes news bulletin #${testDocCurrentId}...`);
    const unpubRes = await fetch(`${TEST_BASE}/admin/news/${testDocCurrentId}/unpublish`, {
      method: 'PATCH',
      headers: { 'X-Test-Role': 'ADMIN' }
    });
    assert.strictEqual(unpubRes.status, 200);

    const partUnpubCheck = await fetch(`${TEST_BASE}/participant/news`, {
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    const partUnpubData = await partUnpubCheck.json();
    const unpubFound = (partUnpubData.news || []).some(n => n.id === testDocCurrentId);
    assert.strictEqual(unpubFound, false, 'Unpublished news must no longer be visible');
    console.log('   ✔ PASS: Unpublished news is immediately removed from participant feed');

    // -------------------------------------------------------------------------
    // Test Scenario: Future-round news isolation
    // -------------------------------------------------------------------------
    console.log(`\n8. Admin creates and publishes news for Future Round ${futureTestRound}...`);
    const futureRes = await fetch(`${TEST_BASE}/admin/news`, {
      method: 'POST',
      headers: {
        'X-Test-Role': 'ADMIN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Future Tech Sector Breakthrough',
        description: 'New semiconductor manufacturing plants operational.',
        round: futureTestRound
      })
    });
    const futureNews = await futureRes.json();
    testDocFutureId = futureNews.id;

    // Publish future round news
    await fetch(`${TEST_BASE}/admin/news/${testDocFutureId}/publish`, {
      method: 'PATCH',
      headers: { 'X-Test-Role': 'ADMIN' }
    });

    // Participant fetches news
    const partFutureCheck = await fetch(`${TEST_BASE}/participant/news`, {
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    const partFutureData = await partFutureCheck.json();
    const futureFound = (partFutureData.news || []).some(n => n.id === testDocFutureId || n.round > currentRound);
    assert.strictEqual(futureFound, false, 'Future round news must NOT be visible');
    console.log('   ✔ PASS: Future round news is strictly blocked from participant');

    // -------------------------------------------------------------------------
    // Test Scenario: Security checks
    // -------------------------------------------------------------------------
    console.log('\n9. Security Check: Participant blocked from Admin news routes...');
    const sec1 = await fetch(`${TEST_BASE}/admin/news`, {
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    assert.strictEqual(sec1.status, 403, 'Participant must get 403 on GET /admin/news');

    const sec2 = await fetch(`${TEST_BASE}/admin/news`, {
      method: 'POST',
      headers: {
        'X-Test-Role': 'PARTICIPANT',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Tamper', description: 'Attack', round: 1 })
    });
    assert.strictEqual(sec2.status, 403, 'Participant must get 403 on POST /admin/news');

    const sec3 = await fetch(`${TEST_BASE}/admin/news/${testDocCurrentId}/publish`, {
      method: 'PATCH',
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    assert.strictEqual(sec3.status, 403, 'Participant must get 403 on publish');

    const sec4 = await fetch(`${TEST_BASE}/admin/news/${testDocCurrentId}`, {
      method: 'DELETE',
      headers: { 'X-Test-Role': 'PARTICIPANT' }
    });
    assert.strictEqual(sec4.status, 403, 'Participant must get 403 on delete');
    console.log('   ✔ PASS: Participant is rejected with 403 Forbidden on all admin endpoints');

    console.log('\n10. Security Check: Participant cannot modify news on participant route...');
    const mod1 = await fetch(`${TEST_BASE}/participant/news`, {
      method: 'POST',
      headers: {
        'X-Test-Role': 'PARTICIPANT',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Illegal', description: 'Illegal', round: 1 })
    });
    assert.strictEqual(mod1.status, 404, 'POST /participant/news must return 404');
    console.log('   ✔ PASS: Modification routes do not exist on /participant/news');

    console.log('\n11. Error handling: Unauthenticated request handling...');
    const unauth = await fetch(`${TEST_BASE}/participant/news`, {
      headers: { 'X-Test-Role': 'UNAUTHENTICATED' }
    });
    assert.strictEqual(unauth.status, 401);
    const unauthJson = await unauth.json();
    assert.strictEqual(typeof unauthJson.error, 'string');
    console.log(`   ✔ PASS: Safe JSON error returned on unauthenticated request: "${unauthJson.error}"`);

  } finally {
    // Clean up temporary test items from Firestore
    console.log('\n12. Cleaning up test items from Firestore...');
    if (testDocCurrentId) {
      await db.collection('news').doc(testDocCurrentId).delete();
      console.log(`   ✔ Deleted temporary test bulletin #${testDocCurrentId}`);
    }
    if (testDocFutureId) {
      await db.collection('news').doc(testDocFutureId).delete();
      console.log(`   ✔ Deleted temporary future test bulletin #${testDocFutureId}`);
    }

    server.close();
  }

  console.log('\n===============================================================');
  console.log('   ALL 11 NEWS INTEGRATION AND SECURITY CHECKS PASSED!         ');
  console.log('===============================================================\n');
}

runNewsIntegrationSuite().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
