/**
 * dmcaBlacklist.ts — DMCA & Copyright Takedown Registry
 *
 * Centralized list of manga series and slugs that have received formal DMCA
 * takedown requests or copyright notices. Adding a slug here permanently
 * disables access across all domains, returns 404 Not Found, and purges it
 * from sitemaps, search, and reading endpoints.
 */

export const BLOCKED_MANGA_SLUGS = new Set<string>([
  'hypnotist-security-guard',
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
