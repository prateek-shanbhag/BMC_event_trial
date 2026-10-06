const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

console.log('initializeApp:', typeof initializeApp);
console.log('getFirestore:', typeof getFirestore);
console.log('getAuth:', typeof getAuth);
