const db = require('../db');

// Default priority hierarchy (lower index = higher priority)
const SOURCE_PRIORITY = [
  'mangaread',
  'coffeemanga',
  'mangakatana',
  'mangadex'
];

/**
 * Returns the priority index of a source. If not found in default list, returns a low priority index.
 */
function getSourcePriorityIndex(sourceId) {
  const idx = SOURCE_PRIORITY.indexOf(sourceId.toLowerCase());
  return idx === -1 ? 999 : idx;
}

/**
 * Resolves the dynamically selected latest source for a given canonical manga.
 * Algorithm:
 * 1. Find all chapters for this manga across all sources.
 * 2. Group by source and find the maximum chapter number for each source.
 * 3. Choose the source with the highest chapter number.
 * 4. In case of a tie in chapter number, select the source with the highest priority (lowest priority index).
 */
async function resolveLatestSource(mangaId) {
  const result = await db.query(`
    SELECT source_id, MAX(chapter_number) as max_chapter, MAX(release_time) as last_updated
    FROM chapters
    WHERE manga_id = $1
    GROUP BY source_id
  `, [mangaId]);

  if (result.rows.length === 0) {
    // If no chapters are scraped/available, fallback to source priority mapping
    const mappingRes = await db.query(`
      SELECT source_id, source_slug
      FROM source_mappings
      WHERE manga_id = $1
    `, [mangaId]);

    if (mappingRes.rows.length === 0) {
      return null;
    }

    // Sort by priority
    mappingRes.rows.sort((a, b) => {
      return getSourcePriorityIndex(a.source_id) - getSourcePriorityIndex(b.source_id);
    });

    return {
      sourceId: mappingRes.rows[0].source_id,
      latestChapter: 0,
      releaseTime: null,
      sourceSlug: mappingRes.rows[0].source_slug,
    };
  }

  // Sort candidates by max_chapter (descending) and then priority index (ascending)
  const candidates = result.rows.map(r => ({
    sourceId: r.source_id,
    maxChapter: parseFloat(r.max_chapter || '0'),
    lastUpdated: r.last_updated,
  }));

  candidates.sort((a, b) => {
    if (b.maxChapter !== a.maxChapter) {
      return b.maxChapter - a.maxChapter;
    }
    return getSourcePriorityIndex(a.sourceId) - getSourcePriorityIndex(b.sourceId);
  });

  const bestCandidate = candidates[0];

  // Fetch the slug for this mapping
  const mappingRes = await db.query(`
    SELECT source_slug FROM source_mappings
    WHERE manga_id = $1 AND source_id = $2
  `, [mangaId, bestCandidate.sourceId]);

  const sourceSlug = mappingRes.rows.length > 0 ? mappingRes.rows[0].source_slug : '';

  return {
    sourceId: bestCandidate.sourceId,
    latestChapter: bestCandidate.maxChapter,
    releaseTime: bestCandidate.lastUpdated,
    sourceSlug,
  };
}

/**
 * Updates the latest_chapter_cache table for a given manga.
 */
async function updateLatestChapterCache(mangaId) {
  const resolved = await resolveLatestSource(mangaId);
  if (!resolved) return;

  await db.query(`
    INSERT INTO latest_chapter_cache (manga_id, latest_chapter_number, source_id, release_time)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (manga_id) DO UPDATE SET
      latest_chapter_number = EXCLUDED.latest_chapter_number,
      source_id = EXCLUDED.source_id,
      release_time = EXCLUDED.release_time
  `, [mangaId, resolved.latestChapter, resolved.sourceId, resolved.releaseTime]);
}

module.exports = {
  SOURCE_PRIORITY,
  getSourcePriorityIndex,
  resolveLatestSource,
  updateLatestChapterCache,
};
