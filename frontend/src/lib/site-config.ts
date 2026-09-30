/**
 * site-config.ts — Multi-domain personality hub
 *
 * Each of the three domains has its own name, colors, SEO copy, and ad codes.
 * Everything reads from env vars so the same Next.js codebase runs on all three
 * Vercel projects — just set NEXT_PUBLIC_SITE_URL (or DOMAIN_PROFILE) differently
 * in each project's environment variables.
 *
 * Usage:
 *   import { siteConfig } from '@/lib/site-config';
 *   siteConfig.name          // "MangaReader" | "MangaRead" | "ManiReader"
 *   siteConfig.ads.aadsUnitId
 *   siteConfig.seo.description
 *   siteConfig.theme.accentColor
 */

export type AdConfig = {
  /** A-ADS (a-ads.com) publisher unit ID — different per domain */
  aadsUnitId: string;
  /** A-ADS iframe background color (hex without #) */
  aadsBgColor: string;
  /** A-ADS title link color (hex without #) */
  aadsTitleColor: string;
  /** Pop-ads / propeller script URL snippet key */
  popAdsKey: string;
  /** Google AdSense publisher ID (ca-pub-xxx) — if using AdSense instead */
  adsenseId: string;
  /** Google site verification meta tag content */
  googleVerification: string;
  /** Bing site verification meta tag content */
  bingVerification: string;
};

export type SeoConfig = {
  /** Short title used in <title> templates */
  title: string;
  /** Longer descriptive tagline */
  tagline: string;
  /** Default meta description */
  description: string;
  /** og:image path (in /public) */
  ogImage: string;
  /** Twitter handle (without @) */
  twitterHandle: string;
  /** Keywords for meta keywords tag */
  keywords: string;
};

export type ThemeConfig = {
  /** Primary brand color (CSS hex) */
  accentColor: string;
  /** Hover / secondary accent */
  accentHover: string;
  /** Dark background color */
  bgDark: string;
  /** Card / surface color */
  bgCard: string;
  /** Google Font family name */
  fontFamily: string;
};

export type SiteConfig = {
  /** Public-facing site name */
  name: string;
  /** Domain profile key */
  profile: 'mangareader.pro' | 'mangaread.pro' | 'manireader.online' | 'dev';
  /** Canonical origin (no trailing slash) */
  url: string;
  ads: AdConfig;
  seo: SeoConfig;
  theme: ThemeConfig;
};

// ── Per-domain definitions ──────────────────────────────────────────────────

const CONFIGS: Record<string, SiteConfig> = {

  // ── 1. mangareader.pro — "The Premier Manga Experience" ─────────────────
  // Dark, polished, deep purple. Serious readers. "Netflix for manga."
  'mangareader.pro': {
    name: 'MangaReader',
    profile: 'mangareader.pro',
    url: 'https://mangareader.pro',
    ads: {
      aadsUnitId:         process.env.NEXT_PUBLIC_AADS_UNIT_ID       || '2454751',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0A0612',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || 'A855F7',
      popAdsKey:          process.env.NEXT_PUBLIC_POP_ADS_KEY         || '',
      adsenseId:          process.env.NEXT_PUBLIC_ADSENSE_ID          || '',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
    },
    seo: {
      title:       'MangaReader — Read Manga Free Online',
      tagline:     'The premier manga reading experience',
      description: 'MangaReader: Read manga, manhwa and manhua free. Sync reading across devices, bookmark chapters and discover new series — all in one place.',
      ogImage:     '/og-mangareader.png',
      twitterHandle: 'mangareader_pro',
      keywords:    'read manga online free, manga reader, manhwa, manhua, best manga site, manga chapters, manga series',
    },
    theme: {
      accentColor: '#A855F7',   // purple-500
      accentHover: '#9333EA',   // purple-600
      bgDark:      '#0A0612',
      bgCard:      '#13091E',
      fontFamily:  'DM Sans',
    },
  },

  // ── 2. mangaread.pro — "Read at the Speed of Thought" ──────────────────
  // Clean, minimal, speed-focused. Sky-blue / slate palette.
  // Emphasises: instant load, no clutter, keyboard shortcuts.
  'mangaread.pro': {
    name: 'MangaRead',
    profile: 'mangaread.pro',
    url: 'https://mangaread.pro',
    ads: {
      aadsUnitId:         process.env.NEXT_PUBLIC_AADS_UNIT_ID       || '2455860',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0C1220',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || '38BDF8',
      popAdsKey:          process.env.NEXT_PUBLIC_POP_ADS_KEY         || '',
      adsenseId:          process.env.NEXT_PUBLIC_ADSENSE_ID          || '',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
    },
    seo: {
      title:       'MangaRead — The Fastest Manga Reader',
      tagline:     'Read at the speed of thought',
      description: 'MangaRead delivers manga chapters instantly — no registration, no popups. Read manhwa, manhua and manga online free with the fastest reader on the web.',
      ogImage:     '/og-mangaread.png',
      twitterHandle: 'mangaread_pro',
      keywords:    'fast manga reader, read manga free, manga online, manhwa reader, manhua reader, no ads manga, instant manga chapters',
    },
    theme: {
      accentColor: '#38BDF8',   // sky-400
      accentHover: '#0EA5E9',   // sky-500
      bgDark:      '#0C1220',
      bgCard:      '#111827',
      fontFamily:  'Inter',
    },
  },

  // ── 3. manireader.online — "Discover Your Next Obsession" ──────────────
  // Vibrant, warm orange + teal. Discovery / community feel.
  // Emphasises: trending, recommendations, social, genre exploration.
  'manireader.online': {
    name: 'ManiReader',
    profile: 'manireader.online',
    url: 'https://manireader.online',
    ads: {
      aadsUnitId:         process.env.NEXT_PUBLIC_AADS_UNIT_ID       || '2455863',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0E0F14',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || 'F97316',
      popAdsKey:          process.env.NEXT_PUBLIC_POP_ADS_KEY         || '',
      adsenseId:          process.env.NEXT_PUBLIC_ADSENSE_ID          || '',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
    },
    seo: {
      title:       'ManiReader — Discover Manga & Manhwa',
      tagline:     'Discover your next manga obsession',
      description: 'ManiReader helps you find your next favourite manga, manhwa or manhua. Explore trending series, genre picks and community favourites — all free.',
      ogImage:     '/og-manireader.png',
      twitterHandle: 'manireader',
      keywords:    'discover manga, trending manga, manga recommendations, best manhwa, webtoon reader, manga discovery, new manga series',
    },
    theme: {
      accentColor: '#F97316',   // orange-500
      accentHover: '#EA580C',   // orange-600
      bgDark:      '#0E0F14',
      bgCard:      '#16171F',
      fontFamily:  'Plus Jakarta Sans',
    },
  },
};

// ── Config resolution ────────────────────────────────────────────────────────

function resolveProfile(): string {
  // 1. Explicit DOMAIN_PROFILE env var (most reliable in Vercel)
  const explicit = process.env.DOMAIN_PROFILE;
  if (explicit && CONFIGS[explicit]) return explicit;

  // 2. Derive from NEXT_PUBLIC_SITE_URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  for (const profile of Object.keys(CONFIGS)) {
    if (siteUrl.includes(profile)) return profile;
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') return 'mangareader.pro';

  console.error('[site-config] Cannot resolve domain profile. Set DOMAIN_PROFILE env var.');
  return 'mangareader.pro';
}

const profile = resolveProfile();
export const siteConfig: SiteConfig = CONFIGS[profile] ?? CONFIGS['mangareader.pro'];

// ── Convenience re-exports ───────────────────────────────────────────────────
export const SITE_NAME = siteConfig.name;
export const SITE_URL  = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
export const AD_CONFIG = siteConfig.ads;
export const SEO       = siteConfig.seo;
export const THEME     = siteConfig.theme;

/** True when AADS banner should be shown */
export const AADS_ENABLED = Boolean(siteConfig.ads.aadsUnitId && siteConfig.ads.aadsUnitId !== '0000000');

/** True when pop-ads script should be injected */
export const POP_ADS_ENABLED = Boolean(siteConfig.ads.popAdsKey);

/** True when Google AdSense should be shown */
export const ADSENSE_ENABLED = Boolean(siteConfig.ads.adsenseId);

