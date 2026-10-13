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
  /**
   * A-ADS unit ID for the 300x250 floating unit (components/AAdsFloat.tsx).
   * Separate from aadsUnitId because the network meters and pays per unit, so
   * the float needs its own ID to attribute its revenue.
   */
  aadsFloatUnitId: string;
  /** A-ADS iframe background color (hex without #) */
  aadsBgColor: string;
  /** A-ADS title link color (hex without #) */
  aadsTitleColor: string;
  /** Google site verification meta tag content */
  googleVerification: string;
  /** Bing site verification meta tag content */
  bingVerification: string;
  /** Hilltop Ads site verification meta tag */
  hilltopVerification?: string;
  /** Hilltop Ads direct link (for download/offline triggers) */
  hilltopDirectLink?: string;
  /** Hilltop Ads VAST 3.0 video tag URL */
  hilltopVastUrl?: string;
  /** Hilltop Popunder script URL */
  popunderSrc?: string;
  /** Umami Analytics script source */
  umamiSrc?: string;
  /** Umami Analytics website ID */
  umamiWebsiteId?: string;
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
      aadsFloatUnitId:    process.env.NEXT_PUBLIC_AADS_FLOAT_UNIT_ID || '2457490',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0A0612',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || 'A855F7',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
      hilltopVerification: process.env.NEXT_PUBLIC_HILLTOP_VERIFICATION || '',
      hilltopDirectLink:   process.env.NEXT_PUBLIC_HILLTOP_DIRECT_LINK   || 'https://purple-text.com/bB3.VM0/Pe3opMvmb/mmVvJ/ZKDL0P3mNPTZEtxqNBjycd3/LYTUcy1-MBTPE/2/OrDmEn',
      hilltopVastUrl:      process.env.NEXT_PUBLIC_HILLTOP_VAST_URL      || 'https://purple-text.com/dWmMF-z.d/GbNvvaZ/GUUG/Ge_md9yuMZJUMlUkhPETKc/0gO/TRYj2ANjT/ckt/NHzmQA5hNZjMYf2HMuQB',
      popunderSrc:         '//purple-text.com/cVDF9c6.bC2T5tlRS/WjQQ9bNgzLMgyWM/DBUByhOAS-0e3/MgzFIBwgNWTEM/zZ',
      umamiSrc:            'https://umami-production-30dc.up.railway.app/script.js',
      umamiWebsiteId:      'ef155174-2e98-4b40-8186-12fe716c14ba',
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
      aadsFloatUnitId:    process.env.NEXT_PUBLIC_AADS_FLOAT_UNIT_ID || '2458319',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0C1220',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || '38BDF8',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
      hilltopVerification: process.env.NEXT_PUBLIC_HILLTOP_VERIFICATION || '',
      hilltopDirectLink:   process.env.NEXT_PUBLIC_HILLTOP_DIRECT_LINK   || 'https://purple-text.com/by3.VC0cP/3Cp-vpb/mIVOJVZtDJ0G3DNHDrQH0WNxDTYw5WLiTgc/0-NND/Q/0uNxzYMt',
      hilltopVastUrl:      process.env.NEXT_PUBLIC_HILLTOP_VAST_URL      || 'https://purple-text.com/dWmMF-z.d/GbNvvaZ/GUUG/Ge_md9yuMZJUMlUkhPETKc/0gO/TRYj2ANjT/ckt/NHzmQA5hNZjMYf2HMuQB',
      popunderSrc:         '//purple-text.com/cyDP9.6nbb2R5-lxS/WBQU9ONdzVMNyENjTgU/zAMXyy0J3nMczdIh1INwTuMl3F',
      umamiSrc:            'https://umami-production-30dc.up.railway.app/script.js',
      umamiWebsiteId:      'ef155174-2e98-4b40-8186-12fe716c14ba',
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
      aadsFloatUnitId:    process.env.NEXT_PUBLIC_AADS_FLOAT_UNIT_ID || '2457490',
      aadsBgColor:        process.env.NEXT_PUBLIC_AADS_BG_COLOR       || '0E0F14',
      aadsTitleColor:     process.env.NEXT_PUBLIC_AADS_TITLE_COLOR    || 'F97316',
      googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
      bingVerification:   process.env.NEXT_PUBLIC_BING_VERIFICATION   || '',
      hilltopVerification: process.env.NEXT_PUBLIC_HILLTOP_VERIFICATION || '1deac198ed672add0c4d5cdb8f28c9d1d92f900f',
      hilltopDirectLink:   process.env.NEXT_PUBLIC_HILLTOP_DIRECT_LINK   || 'https://purple-text.com/b/3/V/0mP.3Lpkv/brmBV-JeZWDM0/3bNUT/EkxlNajfci3ILPT/cT1KMXTEE/2-OLDWEr',
      hilltopVastUrl:      process.env.NEXT_PUBLIC_HILLTOP_VAST_URL      || 'https://purple-text.com/dWmMF-z.d/GbNvvaZ/GUUG/Ge_md9yuMZJUMlUkhPETKc/0gO/TRYj2ANjT/ckt/NHzmQA5hNZjMYf2HMuQB',
      popunderSrc:         '//purple-text.com/c-DC9b6-b.2a5qlISnWTQs9VNZzqMVyYMED/UpygODSX0V3NMGzeIIw/NuT/M_zZ',
      umamiSrc:            'https://umami-production-30dc.up.railway.app/script.js',
      umamiWebsiteId:      'ef155174-2e98-4b40-8186-12fe716c14ba',
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
  // 1. Client-side browser hostname detection (ensures zero mismatch even if same build)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    for (const p of Object.keys(CONFIGS)) {
      if (host.includes(p)) return p;
    }
  }

  // 2. Explicit DOMAIN_PROFILE env var (most reliable in Vercel/Railway)
  const explicit = process.env.DOMAIN_PROFILE || process.env.NEXT_PUBLIC_DOMAIN_PROFILE;
  if (explicit && CONFIGS[explicit]) return explicit;

  // 3. Derive from NEXT_PUBLIC_SITE_URL or SITE_URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '';
  for (const profile of Object.keys(CONFIGS)) {
    if (siteUrl.includes(profile)) return profile;
  }

  // 4. Fallback
  return 'mangareader.pro';
}

const profile = resolveProfile();
export const siteConfig: SiteConfig = CONFIGS[profile] ?? CONFIGS['mangareader.pro'];

/** Helper to get config dynamically with optional hostname override */
export function getSiteConfig(host?: string): SiteConfig {
  if (host) {
    for (const p of Object.keys(CONFIGS)) {
      if (host.toLowerCase().includes(p)) return CONFIGS[p];
    }
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    for (const p of Object.keys(CONFIGS)) {
      if (h.includes(p)) return CONFIGS[p];
    }
  }
  return siteConfig;
}

// ── Convenience re-exports ───────────────────────────────────────────────────
export const SITE_NAME = siteConfig.name;
export const SITE_URL  = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
export const AD_CONFIG = siteConfig.ads;
export const SEO       = siteConfig.seo;
export const THEME     = siteConfig.theme;

/** True when AADS banner should be shown */
export const AADS_ENABLED = Boolean(siteConfig.ads.aadsUnitId && siteConfig.ads.aadsUnitId !== '0000000');

/** True when the AADS 300x250 floating unit should be shown */
export const AADS_FLOAT_ENABLED = Boolean(siteConfig.ads.aadsFloatUnitId && siteConfig.ads.aadsFloatUnitId !== '0000000');

/** True when the Hilltop script should be injected */
export const HILLTOP_ENABLED = Boolean(siteConfig.ads.hilltopVerification);

/** Returns the active domain's voluntary direct link URL (runtime-aware) */
export function getDirectLink(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h.includes('mangaread.pro')) {
      return 'https://purple-text.com/by3.VC0cP/3Cp-vpb/mIVOJVZtDJ0G3DNHDrQH0WNxDTYw5WLiTgc/0-NND/Q/0uNxzYMt';
    }
    if (h.includes('mangareader.pro')) {
      return 'https://purple-text.com/bB3.VM0/Pe3opMvmb/mmVvJ/ZKDL0P3mNPTZEtxqNBjycd3/LYTUcy1-MBTPE/2/OrDmEn';
    }
  }
  return siteConfig.ads.hilltopDirectLink || 'https://purple-text.com/bB3.VM0/Pe3opMvmb/mmVvJ/ZKDL0P3mNPTZEtxqNBjycd3/LYTUcy1-MBTPE/2/OrDmEn';
}

/** Hilltop direct link for download/offline triggers (defaults to active config) */
export const HILLTOP_DIRECT_LINK = siteConfig.ads.hilltopDirectLink || 'https://purple-text.com/bB3.VM0/Pe3opMvmb/mmVvJ/ZKDL0P3mNPTZEtxqNBjycd3/LYTUcy1-MBTPE/2/OrDmEn';

/** Hilltop VAST 3.0 video tag URL */
export const HILLTOP_VAST_URL = siteConfig.ads.hilltopVastUrl || 'https://purple-text.com/dWmMF-z.d/GbNvvaZ/GUUG/Ge_md9yuMZJUMlUkhPETKc/0gO/TRYj2ANjT/ckt/NHzmQA5hNZjMYf2HMuQB';

