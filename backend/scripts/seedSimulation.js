require('dotenv').config({ path: '../.env' }); // Load backend/.env
const { db } = require('../config/firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');

const seedSimulation = async () => {
  try {
    console.log('Starting simulation seed...');

    // 1. Simulation Configuration
    const simulationRef = db.collection('simulation').doc('config');
    await simulationRef.set({
      startingCapital: 1000000,
      totalRounds: 20,
      allocationWindowSeconds: 120,
      currentRound: 0,
      status: 'SETUP',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Updated simulation configuration.');

    // 2. Asset Classes
    const assetClassesRef = db.collection('assetClasses');
    const assetClasses = [
      {
        id: '1',
        name: 'Asset Class 1',
        description: 'Manufacturing (50%), Banking (20%), IT (30%)',
        type: 'COMPOUND',
        composition: {
          Manufacturing: 50,
          Banking: 20,
          IT: 30
        }
      },
      {
        id: '2',
        name: 'Asset Class 2',
        description: 'FMCG (50%), Pharma (20%), Energy (30%)',
        type: 'COMPOUND',
        composition: {
          FMCG: 50,
          Pharma: 20,
          Energy: 30
        }
      },
      {
        id: '3',
        name: 'Asset Class 3',
        description: 'FMCG (25%), Pharma (25%), Energy (25%), IT (25%)',
        type: 'COMPOUND',
        composition: {
          FMCG: 25,
          Pharma: 25,
          Energy: 25,
          IT: 25
        }
      },
      {
        id: '4',
        name: 'Asset Class 4',
        description: 'Government Securities',
        type: 'SINGLE'
      },
      {
        id: '5',
        name: 'Asset Class 5',
        description: 'Bank Fixed Deposits',
        type: 'SINGLE'
      },
      {
        id: '6',
        name: 'Asset Class 6',
        description: 'Real Estate',
        type: 'SINGLE'
      },
      {
        id: '7',
        name: 'Asset Class 7',
        description: 'Gold',
        type: 'SINGLE'
      }
    ];

    for (const assetClass of assetClasses) {
      const docRef = assetClassesRef.doc(assetClass.id);
      await docRef.set({
        ...assetClass,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      
      // If we are changing types, let's remove any legacy composition for SINGLE types
      if (assetClass.type === 'SINGLE') {
        await docRef.update({
          composition: FieldValue.delete()
        });
      }
      console.log(`Updated Asset Class ${assetClass.id}.`);
    }

    // 3. Rounds
    const roundsRef = db.collection('rounds');
    
    // Round 0: Initial Allocation Phase
    await roundsRef.doc('0').set({
      roundNumber: 0,
      type: 'INITIAL_ALLOCATION',
      status: 'PENDING',
      startTime: null,
      allocationDeadline: null,
      endTime: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('Updated Round 0 (INITIAL_ALLOCATION).');

    // Rounds 1-20: Simulation Rounds
    for (let i = 1; i <= 20; i++) {
      const roundId = i.toString();
      const docRef = roundsRef.doc(roundId);
      await docRef.set({
        roundNumber: i,
        type: 'SIMULATION',
        status: 'PENDING',
        startTime: null,
        allocationDeadline: null,
        endTime: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`Updated Round ${i} (SIMULATION).`);
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seedSimulation();
