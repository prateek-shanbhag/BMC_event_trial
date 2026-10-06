require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;


const requiredEnvVars = [
  'FRONTEND_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`ERROR: Missing required backend environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please configure these in your backend/.env file.');
  process.exit(1);
}

// Import Firebase Admin configuration after env vars are validated
const { app: firebaseApp } = require('./config/firebaseAdmin');

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const configuredOrigin = process.env.FRONTEND_URL || '';
    
    // For local development: if FRONTEND_URL is a localhost URL, allow any localhost port
    if (configuredOrigin.startsWith('http://localhost') && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    
    // Otherwise strictly match the configured origin
    if (origin === configuredOrigin) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const participantRoutes = require('./routes/participant');
const newsRoutes = require('./routes/news');
const assetValuesRoutes = require('./routes/assetValues');
const { authenticateRequest, requireAdmin, requireParticipant } = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateRequest, requireAdmin, adminRoutes);
app.use('/api/admin/news', authenticateRequest, requireAdmin, newsRoutes);
app.use('/api/admin/asset-values', authenticateRequest, requireAdmin, assetValuesRoutes);
app.use('/api/participant', authenticateRequest, requireParticipant, participantRoutes);
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy' });
});

// Firebase connectivity check endpoint
app.get('/api/health/firebase', (req, res) => {
  if (firebaseApp) {
    res.status(200).json({ 
      status: 'ok', 
      message: 'Firebase Admin initialized successfully',
      appName: firebaseApp.name 
    });
  } else {
    res.status(500).json({ 
      status: 'error', 
      message: 'Firebase Admin is not initialized' 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use. Is another instance running?`);
  } else {
    console.error('ERROR: Failed to start server:', err);
  }
  process.exit(1);
});
