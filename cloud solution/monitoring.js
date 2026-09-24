/**
 * routes/monitoring.js — Anti-blocking health dashboard
 *
 * Add to backend/index.js:
 *   app.use('/admin/monitoring', require('./routes/monitoring'));
 *
 * Protected by ADMIN_TOKEN.  Access:
 *   GET /admin/monitoring/scrapers          — per-domain circuit breaker + limiter state
 *   GET /admin/monitoring/scrapers/reset    — reset a breaker (POST)
 */

'use strict';

const express = require('express');
const router  = express.Router();

// Inline token check (mirrors your existing requireAdmin logic)
function requireToken(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireToken);

// GET /admin/monitoring/scrapers
router.get('/scrapers', (req, res) => {
  try {
    const antiBlock = require('../extractors/antiBlock');
    const stats = antiBlock.getAllStats();
    res.json({
      timestamp: new Date().toISOString(),
      domain:    process.env.DOMAIN_PROFILE || 'unknown',
      scrapers:  stats,
      summary: {
        total:     Object.keys(stats).length,
        openBreakers: Object.entries(stats)
          .filter(([, s]) => s.breaker?.state === 'OPEN')
          .map(([host]) => host),
        halfOpenBreakers: Object.entries(stats)
          .filter(([, s]) => s.breaker?.state === 'HALF_OPEN')
          .map(([host]) => host),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/monitoring/scrapers/:hostname/reset — force-close a circuit breaker
router.post('/scrapers/:hostname/reset', (req, res) => {
  try {
    const { hostname } = req.params;
    const antiBlock    = require('../extractors/antiBlock');
    const stats        = antiBlock.getLimiterStats(hostname);
    if (!stats) return res.status(404).json({ error: `No breaker found for ${hostname}` });
    // Access internal state via getAllStats (read-only) — instruct manual restart if needed
    res.json({
      message: `To reset ${hostname}: redeploy or restart the backend service. Circuit breakers reset on startup.`,
      current: stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/monitoring/cache — Redis cache hit/miss (if Redis connected)
router.get('/cache', async (req, res) => {
  try {
    const { getRedisClient } = require('../middleware/rateLimit');
    const rc = getRedisClient();
    if (!rc || rc.status !== 'ready') {
      return res.json({ redis: 'not connected', fallback: 'in-memory NodeCache' });
    }
    const info = await rc.info('stats');
    const hits   = info.match(/keyspace_hits:(\d+)/)?.[1] ?? 'n/a';
    const misses = info.match(/keyspace_misses:(\d+)/)?.[1] ?? 'n/a';
    const keys   = await rc.dbsize();
    res.json({ redis: 'connected', status: rc.status, keys, hits, misses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
