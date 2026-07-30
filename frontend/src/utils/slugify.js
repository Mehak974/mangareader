/**
 * Convert a manga title into a URL-safe slug.
 * e.g. "Solo Leveling" → "solo-leveling"
 *      "One Punch-Man!" → "one-punch-man"
 *
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  if (!title) return "";
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")           // remove smart quotes
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // preserve letters/numbers from ANY language
    .replace(/[\s_]+/g, "-")        // spaces/underscores → hyphens
    .replace(/-+/g, "-")            // collapse consecutive hyphens
    .replace(/^-|-$/g, "");         // trim leading/trailing hyphens

  if (!slug) {
    // Ultimate fallback if regex strips everything
    slug = encodeURIComponent(title.toLowerCase().trim().replace(/[\s_]+/g, "-"));
  }
  return slug;
}
