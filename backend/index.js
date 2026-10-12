require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;


if (!process.env.FRONTEND_URL) {
  console.error('ERROR: Missing required backend environment variable: FRONTEND_URL');
  console.error('Please configure FRONTEND_URL in your environment or backend/.env file (e.g. FRONTEND_URL=https://your-staging-site.web.app).');
  process.exit(1);
}

const hasGoogleAppCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasInlineCreds = !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
const isGcpEnvironment = !!(process.env.K_SERVICE || process.env.GAE_ENV);

if (!hasGoogleAppCreds && !hasInlineCreds && !isGcpEnvironment) {
  console.error('ERROR: Missing Firebase Admin credential configuration.');
  console.error('For local development, set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file outside the repository:');
  console.error('  GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"');
  console.error('For hosted environments (such as Render), configure secret environment variables:');
  console.error('  FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

// Import Firebase Admin configuration after env vars are validated
let firebaseApp;
try {
  const adminConfig = require('./config/firebaseAdmin');
  firebaseApp = adminConfig.app;
} catch (err) {
  process.exit(1);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server health checks)
    if (!origin) return callback(null, true);
    
    const configured = process.env.FRONTEND_URL || '';
    const allowedOrigins = configured.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    
    // For local development: if FRONTEND_URL contains a localhost URL, permit any localhost port
    const allowsLocalhost = allowedOrigins.some(o => o.startsWith('http://localhost'));
    if (allowsLocalhost && /^http:\/\/localhost:\d+$/.test(normalizedOrigin)) {
      return callback(null, true);
    }
    
    // Strictly match configured origin(s)
    if (allowedOrigins.includes(normalizedOrigin)) {
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
const simulationRoutes = require('./routes/simulation');
const allocationsRoutes = require('./routes/allocations');
const { adminRouter: adminPortfoliosRouter, participantRouter: participantPortfolioRouter } = require('./routes/portfolios');
const leaderboardRoutes = require('./routes/leaderboard');
const { authenticateRequest, requireAdmin, requireParticipant } = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateRequest, requireAdmin, adminRoutes);
app.use('/api/admin/news', authenticateRequest, requireAdmin, newsRoutes);
app.use('/api/admin/asset-values', authenticateRequest, requireAdmin, assetValuesRoutes);
app.use('/api/admin/simulation', authenticateRequest, requireAdmin, simulationRoutes);
app.use('/api/admin/portfolios', authenticateRequest, requireAdmin, adminPortfoliosRouter);
app.use('/api/admin/leaderboard', authenticateRequest, requireAdmin, leaderboardRoutes);
app.use('/api/participant', authenticateRequest, requireParticipant, participantRoutes);
app.use('/api/participant/allocation', allocationsRoutes);
app.use('/api/participant/portfolio', authenticateRequest, requireParticipant, participantPortfolioRouter);
app.use('/api/participant/leaderboard', authenticateRequest, requireParticipant, leaderboardRoutes);
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is healthy' });
});

// Fallback 404 handler to ensure JSON responses instead of Express HTML 404s
app.use((req, res, next) => {
  res.status(404).json({ error: `Not Found: ${req.originalUrl}` });
});

// Global error handler to ensure JSON responses instead of Express HTML 500s
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
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
