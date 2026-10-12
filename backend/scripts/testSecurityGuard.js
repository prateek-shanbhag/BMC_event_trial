const path = require('path');
const fetch = require('node-fetch');

// Load .env from backend/.env if available
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Validates and retrieves required test credentials from environment variables.
 * Fails safely with an explicit message if any required variable is missing.
 * Never prints secret values in error messages.
 */
function getTestCredentials(options = {}) {
  const { requireParticipant2 = false } = options;

  const required = [
    'FIREBASE_WEB_API_KEY',
    'TEST_ADMIN_EMAIL',
    'TEST_ADMIN_PASSWORD',
    'TEST_PARTICIPANT_EMAIL',
    'TEST_PARTICIPANT_PASSWORD'
  ];

  if (requireParticipant2) {
    required.push('TEST_PARTICIPANT_2_EMAIL', 'TEST_PARTICIPANT_2_PASSWORD');
  }

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`\n❌ SECURITY ERROR: Missing required test environment variable(s): ${missing.join(', ')}`);
    console.error('Please configure these in your environment or backend/.env before running test scripts.');
    console.error('Refer to backend/.env.example and docs/TESTING_SECURITY.md for setup instructions.\n');
    process.exit(1);
  }

  return {
    apiKey: process.env.FIREBASE_WEB_API_KEY,
    adminEmail: process.env.TEST_ADMIN_EMAIL,
    adminPassword: process.env.TEST_ADMIN_PASSWORD,
    participantEmail: process.env.TEST_PARTICIPANT_EMAIL,
    participantPassword: process.env.TEST_PARTICIPANT_PASSWORD,
    participant2Email: process.env.TEST_PARTICIPANT_2_EMAIL,
    participant2Password: process.env.TEST_PARTICIPANT_2_PASSWORD
  };
}

/**
 * Authenticates against Firebase Auth REST API using the provided API key and credentials.
 * Does not log credentials or token contents.
 */
async function loginTestUser(apiKey, email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.error?.message || res.statusText;
    throw new Error(`Authentication failed for ${email}: ${message}`);
  }

  const data = await res.json();
  return data.idToken;
}

/**
 * Validates all safety guards before any destructive Firestore operations (reset, delete, purge).
 * 
 * Safety conditions:
 * 1. ALLOW_DESTRUCTIVE_TESTS must be 'true'.
 * 2. NODE_ENV must be 'test'.
 * 3. TEST_FIREBASE_PROJECT_ID must be specified and non-empty.
 * 4. The configured Firebase project ID must match TEST_FIREBASE_PROJECT_ID exactly.
 * 5. CLI arguments must include '--confirm-destructive-test'.
 * 6. Deletion of protected collections ('users', 'teams') is strictly prohibited.
 */
function assertDestructiveOperationsAllowed(collectionsToAffect, actualFirebaseProjectId) {
  const FORBIDDEN_COLLECTIONS = ['users', 'teams', 'user', 'team'];

  // Check 1: Deletion of forbidden collections
  if (Array.isArray(collectionsToAffect)) {
    for (const col of collectionsToAffect) {
      if (FORBIDDEN_COLLECTIONS.includes(col.toLowerCase())) {
        console.error(`\n❌ SECURITY VIOLATION: Attempted to delete or modify protected collection: "${col}"`);
        console.error('Scripts are strictly forbidden from deleting or resetting "users" or "teams".\n');
        process.exit(1);
      }
    }
  }

  // Check 2: ALLOW_DESTRUCTIVE_TESTS flag
  if (process.env.ALLOW_DESTRUCTIVE_TESTS !== 'true') {
    console.error('\n❌ DESTRUCTIVE ACTION BLOCKED:');
    console.error('Environment variable ALLOW_DESTRUCTIVE_TESTS must be explicitly set to "true".');
    console.error('Current value:', process.env.ALLOW_DESTRUCTIVE_TESTS || '(unset)');
    process.exit(1);
  }

  // Check 3: NODE_ENV === 'test'
  if (process.env.NODE_ENV !== 'test') {
    console.error('\n❌ DESTRUCTIVE ACTION BLOCKED:');
    console.error('Environment variable NODE_ENV must be set to "test".');
    console.error('Current value:', process.env.NODE_ENV || '(unset)');
    process.exit(1);
  }

  // Check 4: TEST_FIREBASE_PROJECT_ID allowlist presence
  const approvedProjectId = process.env.TEST_FIREBASE_PROJECT_ID;
  if (!approvedProjectId) {
    console.error('\n❌ DESTRUCTIVE ACTION BLOCKED:');
    console.error('TEST_FIREBASE_PROJECT_ID is not set. An explicit project ID allowlist is required.');
    process.exit(1);
  }

  // Check 5: Match configured project ID against allowlist
  if (!actualFirebaseProjectId || actualFirebaseProjectId !== approvedProjectId) {
    console.error('\n❌ DESTRUCTIVE ACTION BLOCKED:');
    console.error(`Configured Firebase project (${actualFirebaseProjectId || 'unknown'}) does not match approved TEST_FIREBASE_PROJECT_ID (${approvedProjectId}).`);
    process.exit(1);
  }

  // Check 6: Command-line confirmation flag
  const hasConfirmationArg = process.argv.includes('--confirm-destructive-test');
  if (!hasConfirmationArg) {
    console.error('\n❌ DESTRUCTIVE ACTION BLOCKED:');
    console.error("Missing mandatory command-line flag: '--confirm-destructive-test'");
    console.error('To run this destructive script, append the flag explicitly:');
    console.error(`  node ${path.basename(process.argv[1] || 'script.js')} --confirm-destructive-test\n`);
    process.exit(1);
  }

  // If all checks pass, print target project ID and affected collections
  console.log('\n======================================================');
  console.log('⚠️  DESTRUCTIVE OPERATION SAFETY CHECK PASSED');
  console.log(`Target Firebase Project ID: ${actualFirebaseProjectId}`);
  if (collectionsToAffect && collectionsToAffect.length > 0) {
    console.log(`Collections affected:       ${collectionsToAffect.join(', ')}`);
  }
  console.log('======================================================\n');
}

module.exports = {
  getTestCredentials,
  loginTestUser,
  assertDestructiveOperationsAllowed
};
