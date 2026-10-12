const { auth, db, app } = require('../config/firebaseAdmin');
const { getTestCredentials, loginTestUser, assertDestructiveOperationsAllowed } = require('./testSecurityGuard');

async function main() {
  const targetProjectId = app.options.projectId || db.projectId || process.env.FIREBASE_PROJECT_ID;
  assertDestructiveOperationsAllowed([], targetProjectId);

  const creds = getTestCredentials({ requireParticipant2: true });

  // 1. Ensure admin user has configured test password
  try {
    const adminUser = await auth.getUserByEmail(creds.adminEmail);
    await auth.updateUser(adminUser.uid, { password: creds.adminPassword });
    console.log(`Updated ${creds.adminEmail} password`);
  } catch (e) {
    console.log('Admin user update failed:', e.message);
  }

  // 2. Ensure participant 1 exists with configured test password
  let helloUid = '2SqvWQ0QdweOGZVptZb5Ik5VqSn1';
  try {
    let helloUser;
    try {
      helloUser = await auth.getUserByEmail(creds.participantEmail);
      await auth.updateUser(helloUser.uid, { password: creds.participantPassword });
      helloUid = helloUser.uid;
      console.log(`Updated existing ${creds.participantEmail} password`);
    } catch {
      helloUser = await auth.createUser({
        uid: helloUid,
        email: creds.participantEmail,
        password: creds.participantPassword,
        displayName: 'Test Participant 1'
      });
      console.log(`Created ${creds.participantEmail} in Auth`);
    }
  } catch (e) {
    console.error(`Error creating/updating ${creds.participantEmail}:`, e.message);
  }

  // 3. Ensure participant 2 exists with configured test password
  let hello2Uid = 'FiHCEFbcpnhZoEsX994w9c6ooSC2';
  try {
    let hello2User;
    try {
      hello2User = await auth.getUserByEmail(creds.participant2Email);
      await auth.updateUser(hello2User.uid, { password: creds.participant2Password });
      hello2Uid = hello2User.uid;
      console.log(`Updated existing ${creds.participant2Email} password`);
    } catch {
      hello2User = await auth.createUser({
        uid: hello2Uid,
        email: creds.participant2Email,
        password: creds.participant2Password,
        displayName: 'Test Participant 2'
      });
      console.log(`Created ${creds.participant2Email} in Auth`);
    }
  } catch (e) {
    console.error(`Error creating/updating ${creds.participant2Email}:`, e.message);
  }

  // Ensure Firestore user document for participant 1
  await db.collection('users').doc(helloUid).set({
    uid: helloUid,
    email: creds.participantEmail,
    name: 'Team Alpha Participant',
    role: 'PARTICIPANT',
    teamId: 'team_A'
  }, { merge: true });

  // Ensure Firestore user document for participant 2
  await db.collection('users').doc(hello2Uid).set({
    uid: hello2Uid,
    email: creds.participant2Email,
    name: 'Team Beta Participant',
    role: 'PARTICIPANT',
    teamId: 'team_B'
  }, { merge: true });

  // Ensure teams have both memberUids and correct properties
  await db.collection('teams').doc('team_A').set({
    id: 'team_A',
    teamId: 'team_A',
    name: 'Team Alpha',
    memberUids: [helloUid]
  }, { merge: true });

  await db.collection('teams').doc('team_B').set({
    id: 'team_B',
    teamId: 'team_B',
    name: 'Team Beta',
    memberUids: [hello2Uid]
  }, { merge: true });

  // Verify signIn for all users
  const checkLogin = async (email, password) => {
    try {
      await loginTestUser(creds.apiKey, email, password);
      console.log(`Login test for ${email}: SUCCESS`);
    } catch (err) {
      console.log(`Login test for ${email}: FAILED (${err.message})`);
    }
  };

  await checkLogin(creds.adminEmail, creds.adminPassword);
  await checkLogin(creds.participantEmail, creds.participantPassword);
  await checkLogin(creds.participant2Email, creds.participant2Password);

  process.exit(0);
}

main().catch(err => {
  console.error('Error during setup-test-users:', err.message);
  process.exit(1);
});
