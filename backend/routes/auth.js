const express = require('express');
const { authenticateRequest } = require('../middleware/auth');
const router = express.Router();

router.get('/me', authenticateRequest, (req, res) => {
  // return safe user info
  res.json({
    uid: req.user.uid,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    teamId: req.user.teamId || null
  });
});

module.exports = router;
