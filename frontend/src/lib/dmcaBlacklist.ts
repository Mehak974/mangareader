/**
 * dmcaBlacklist.ts — DMCA Takedown & Anti-Copyright Protection Registry
 *
 * Centralized list of manga series and slugs that have received copyright
 * takedown notices (Lumen / ChillingEffects / Cloudflare).
 *
 * Architecture:
 *  - `/manga/[title]`: Returns permanent 404 for these slugs so anti-piracy
 *    verification crawlers see "Content Removed / 404 Not Found" and resolve
 *    the complaint.
 *  - `/series/[title]`: Protected mirror route with `noindex, nofollow` meta
 *    and robots.txt disallow. Real readers on the site can read all chapters
 *    without 404s, while search bots never index the series.
 */

import { slugify } from '@/utils/slugify';

export const BLOCKED_MANGA_SLUGS = new Set<string>([
  'buin-eun-milbat-eseo-gidaryeotda',
  'hypnotist-security-guard',
  'empress-cesia-wears-knickerbockers',
  'obedient-pregnancy',
  'paljae-child-of-winter',
  'seducing-the-jerk',
  'the-cruelty-of-atonement',
  'the-perks-of-being-a-villain',
  'friend-or-faux',
  'body-position',
  'romance-is-dead',
  'the-heroines-want-me-dead',
  'it-was-just-a-contractual-marriage',
  'the-11th-school-trip',
  'playmate',
  'a-butterfly-through-the-mist',
  'curious-miss-elena',
  'love-order',
  'mokrin',
  'that-secretive-sob',
  'to-the-one-without-virtue',
  'when-fate-finds-us',
  'baby-light-my-fire',
  'my-possession-became-a-ghost-story',
  'to-tread-into-darkness',
  'her-merry-obsession',
  'trash-will-always-be-trash',
  'meet-me-halfway',
  'codename-anastasia',
  'gate-where-the-jsdf-fought',
  'the-player-with-13-hidden-traits',
  'the-rogue-prince-is-secretly-an-omega',
  'the-fragrant-flower-blooms-with-dignity',
  'koushaku-sama-akusai-no-watashi-wa-mou-houtteoite-kudasai',
  'ohitorisama-ni-wa-naremashita-node-konyakusha-houchichuu',
  'the-man-in-the-box',
  'the-princess-groom',
  'toilet-bound-hanako-kun-vol-0',
  'your-grace-please-just-forget-about-this-wicked-wife',
  'yankee-jk-kuzuhana-chan',
  'baron-the-cat-returns',
  'boys-abyss',
  'caste-heaven',
  'dead-dead-demons-dededede-destruction',
  'bound',
  'tangled-feelings-tugged-loose',
  'my-childhood-friends-are-trying-to-kill-me',
  'lili-men',
]);

export function isBlockedManga(slugOrTitle?: string | null): boolean {
  if (!slugOrTitle) return false;
  const normalized = slugOrTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return BLOCKED_MANGA_SLUGS.has(normalized);
}

/**
 * Generates the appropriate link for a manga title.
 * Protected/reported titles route to the unindexed `/series/` route.
 * Safe titles route to the standard `/manga/` route.
 */
export function getMangaHref(slugOrTitle?: string | null, cover?: string | null, isKorean?: boolean): string {
  if (!slugOrTitle) return '/';
  const slug = slugify(slugOrTitle);
  const base = (isBlockedManga(slug) || isKorean) ? `/manga/series/${slug}` : `/manga/${slug}`;
  return cover ? `${base}?cover=${encodeURIComponent(cover)}` : base;
}
