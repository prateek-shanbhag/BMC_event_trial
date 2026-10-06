const { db, auth } = require('../config/firebaseAdmin');

const authenticateRequest = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    // Fetch user from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    let user;

    if (userDoc.exists) {
      user = userDoc.data();
    } else {
      // Auto-create user with default safe role
      user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || '',
        role: 'PARTICIPANT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.collection('users').doc(decodedToken.uid).set(user);
    }
    
    req.user = user;
    next();
  } catch (error) {
    // We shouldn't log token values, only generic error messages
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Insufficient permissions: ADMIN required' });
  }
  next();
};

const requireParticipant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  if (req.user.role !== 'PARTICIPANT') {
    return res.status(403).json({ error: 'Insufficient permissions: PARTICIPANT required' });
  }
  next();
};

module.exports = {
  authenticateRequest,
  requireAdmin,
  requireParticipant
};
