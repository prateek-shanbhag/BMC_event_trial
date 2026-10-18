const assert = require('assert');

console.log('--- Testing Participant News Filtering Logic ---');

// Mock news collection data
const mockNewsDocs = [
  { id: 'n1', title: 'Round 1 Draft', description: 'Desc 1', round: 1, status: 'DRAFT', createdAt: '2026-10-18T10:00:00Z', updatedAt: '2026-10-18T10:05:00Z' },
  { id: 'n2', title: 'Round 1 Published A', description: 'Desc 2', round: 1, status: 'PUBLISHED', createdAt: '2026-10-18T10:10:00Z', updatedAt: '2026-10-18T10:15:00Z' },
  { id: 'n3', title: 'Round 1 Published B', description: 'Desc 3', round: 1, status: 'PUBLISHED', createdAt: '2026-10-18T10:20:00Z', updatedAt: '2026-10-18T10:25:00Z' },
  { id: 'n4', title: 'Round 2 Published', description: 'Desc 4', round: 2, status: 'PUBLISHED', createdAt: '2026-10-18T11:00:00Z', updatedAt: '2026-10-18T11:05:00Z' },
  { id: 'n5', title: 'Round 3 Published', description: 'Desc 5', round: 3, status: 'PUBLISHED', createdAt: '2026-10-18T12:00:00Z', updatedAt: '2026-10-18T12:05:00Z' }
];

function filterParticipantNews(docs, currentRound) {
  if (currentRound <= 0) {
    return [];
  }
  const newsList = [];
  docs.forEach(data => {
    if (data.status === 'PUBLISHED' && data.round === currentRound) {
      newsList.push({
        id: data.id,
        title: data.title,
        description: data.description,
        round: data.round,
        createdAt: data.createdAt
      });
    }
  });
  newsList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return newsList;
}

// Case 1: Round 0 (SETUP / ALLOCATION) -> returns empty array
const r0 = filterParticipantNews(mockNewsDocs, 0);
assert.strictEqual(r0.length, 0, 'Round 0 must return 0 news');
console.log('✔ Case 1 PASS: Round 0 returns empty array');

// Case 2: Round 1 -> returns only published news for round 1, sorted by createdAt desc, no drafts
const r1 = filterParticipantNews(mockNewsDocs, 1);
assert.strictEqual(r1.length, 2, 'Round 1 must return 2 published items');
assert.strictEqual(r1[0].id, 'n3', 'Newest item first');
assert.strictEqual(r1[1].id, 'n2', 'Older item second');
assert.strictEqual(r1[0].status, undefined, 'Must not expose status');
assert.strictEqual(r1[0].updatedAt, undefined, 'Must not expose updatedAt');
console.log('✔ Case 2 PASS: Round 1 returns only published Round 1 items, newest first, without admin fields');

// Case 3: Round 2 -> returns only published news for round 2, excludes round 1 and round 3
const r2 = filterParticipantNews(mockNewsDocs, 2);
assert.strictEqual(r2.length, 1, 'Round 2 must return 1 item');
assert.strictEqual(r2[0].id, 'n4');
console.log('✔ Case 3 PASS: Round 2 returns only Round 2 items, excludes past round 1 and future round 3');

// Case 4: Round 5 -> no news exists for round 5
const r5 = filterParticipantNews(mockNewsDocs, 5);
assert.strictEqual(r5.length, 0);
console.log('✔ Case 4 PASS: Unpopulated round returns empty array');

console.log('--- ALL UNIT FILTER CHECKS PASSED ---');
