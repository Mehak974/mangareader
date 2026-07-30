const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. See backend/.env.example.');
}
const JWT_SECRET = process.env.JWT_SECRET;

/** Constant-time string comparison (avoids leaking match-length via timing). */
function safeCompare(a, b) {
  const aBuf = Buffer.from(String(a ?? ''));
  const bBuf = Buffer.from(String(b ?? ''));
  // Buffers of different lengths would throw in timingSafeEqual; comparing
  // against a same-length buffer first still avoids a length-based early exit
  // being the *only* signal (both branches always run one full compare).
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// In a real implementation, you would check against a DB table of admins.
// For now, this validates against an env var ADMIN_PASSWORD.
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin password not configured on server' });
  }

  if (typeof password === 'string' && safeCompare(password, adminPassword)) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
});

module.exports = router;
