const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let JWT_SECRET;
let ADMIN_TOKEN_BUF;

function initAuth() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start. Set it in your environment (see backend/.env.example).');
    process.exit(1);
  }
  if (!process.env.ADMIN_TOKEN) {
    console.error('FATAL: ADMIN_TOKEN is not set. Refusing to start. Set it in your environment (see backend/.env.example).');
    process.exit(1);
  }
  JWT_SECRET = process.env.JWT_SECRET;
  ADMIN_TOKEN_BUF = Buffer.from(process.env.ADMIN_TOKEN);
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const legacyToken = req.headers['x-admin-token'];
    if (legacyToken) {
      const tokenBuf = Buffer.from(legacyToken);
      if (tokenBuf.length === ADMIN_TOKEN_BUF.length && crypto.timingSafeEqual(tokenBuf, ADMIN_TOKEN_BUF)) {
        return next();
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

module.exports = { initAuth, requireAdmin };
