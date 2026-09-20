/**
 * domains.js — Backend per-domain configuration
 *
 * Each domain gets its own backend deployment (Railway / Render project).
 * Set DOMAIN_PROFILE in each backend's environment variables.
 *
 * Usage in index.js:
 *   const domainCfg = require('./config/domains').getConfig();
 */

'use strict';

const DOMAIN_CONFIGS = {

  // ── mangareader.pro ───────────────────────────────────────────────────────
  'mangareader.pro': {
    siteName: 'MangaReader',
    tagline: 'Read manga free online — the premier experience',
    allowedOrigins: [
      'https://mangareader.pro',
      'https://www.mangareader.pro',
    ],
    // Scraper source preference order for this domain
    preferredSources: ['mangadex', 'manganato', 'mangaread', 'mangakatana'],
    // Cache TTL multipliers (1.0 = default, higher = cache longer)
    cacheTtlMultiplier: 1.0,
    // Rate limit overrides for the public API
    rateLimit: {
      windowMs: 60000,
      max: 120,
    },
    // Maintenance mode (overrides env if set here)
    maintenanceMode: false,
  },

  // ── mangaread.pro ─────────────────────────────────────────────────────────
  'mangaread.pro': {
    siteName: 'MangaRead',
    tagline: 'Fast manga reading — blazing speed, zero fuss',
    allowedOrigins: [
      'https://mangaread.pro',
      'https://www.mangaread.pro',
    ],
    preferredSources: ['mangaread', 'mangadex', 'manganato', 'mangakatana'],
    cacheTtlMultiplier: 1.2,  // cache slightly longer — "speed" UX focus
    rateLimit: {
      windowMs: 60000,
      max: 150,
    },
    maintenanceMode: false,
  },

  // ── manireader.online ─────────────────────────────────────────────────────
  'manireader.online': {
    siteName: 'ManiReader',
    tagline: 'Discover your next manga obsession',
    allowedOrigins: [
      'https://manireader.online',
      'https://www.manireader.online',
    ],
    preferredSources: ['mangadex', 'mangakatana', 'manganato', 'mangaread'],
    cacheTtlMultiplier: 0.8,  // fresher content — discovery focus
    rateLimit: {
      windowMs: 60000,
      max: 100,
    },
    maintenanceMode: false,
  },
};

// Development / staging fallback
const DEV_CONFIG = {
  siteName: 'MangaReader (Dev)',
  tagline: 'Development mode',
  allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  preferredSources: ['mangadex', 'manganato', 'mangaread', 'mangakatana'],
  cacheTtlMultiplier: 0.1,  // short cache in dev
  rateLimit: { windowMs: 60000, max: 1000 },
  maintenanceMode: false,
};

/**
 * Returns the config for the current deployment.
 * Reads DOMAIN_PROFILE env var (set this in Railway/Render env settings).
 */
function getConfig() {
  const profile = process.env.DOMAIN_PROFILE || '';
  if (DOMAIN_CONFIGS[profile]) return DOMAIN_CONFIGS[profile];

  // Auto-detect from ALLOWED_ORIGINS if DOMAIN_PROFILE isn't set
  const origins = process.env.ALLOWED_ORIGINS || '';
  for (const [domain, cfg] of Object.entries(DOMAIN_CONFIGS)) {
    if (origins.includes(domain)) return cfg;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('[domains] WARNING: No DOMAIN_PROFILE set in production!');
    console.error('[domains] Set DOMAIN_PROFILE to one of:', Object.keys(DOMAIN_CONFIGS).join(', '));
  }
  return DEV_CONFIG;
}

/**
 * Returns the preferred source list for the current domain.
 * The extractor picks sources in this order when doing multi-source search.
 */
function getPreferredSources() {
  return getConfig().preferredSources;
}

/**
 * Returns ALLOWED_ORIGINS array (replaces hardcoded list in index.js).
 */
function getAllowedOrigins() {
  const cfg = getConfig();
  // Always include localhost for dev
  if (process.env.NODE_ENV !== 'production') {
    return [...cfg.allowedOrigins, 'http://localhost:3000', 'http://localhost:3001'];
  }
  return cfg.allowedOrigins;
}

module.exports = { getConfig, getPreferredSources, getAllowedOrigins, DOMAIN_CONFIGS };
