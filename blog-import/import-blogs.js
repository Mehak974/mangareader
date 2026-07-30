/**
 * Blog Import Script — 326 Articles
 * ==================================
 * Reads articles-data.json and imports every article into the database.
 *
 * Each article is created as SCHEDULED, publishing one every 25 hours
 * starting tomorrow at 10:00 UTC. No cron job needed — the blog API
 * returns any article where scheduledFor <= NOW().
 *
 * Usage:
 *   cd blog-import
 *   node import-blogs.js
 *
 * Prerequisites:
 *   1. Set DATABASE_URL in frontend/.env.local (Neon connection string)
 *   2. Run: cd frontend && npx prisma db push && npx prisma db seed
 *   3. Run: cd blog-import && npm install
 *   4. Run: node parse-articles.js   (generates articles-data.json)
 *   5. Run: node import-blogs.js
 */

require('dotenv').config({ path: '../frontend/.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const articles = require('./articles-data.json');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SITE_URL     = (process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com').replace(/\/$/, '');
const HOURS_GAP    = 25;          // 24–26h window — one post every 25 hours
const FIRST_HOUR   = 10;          // 10:00 UTC for first post (tomorrow)
const AUTHOR_SLUG  = 'editorial-team';
const BATCH_SIZE   = 10;          // Prisma batch size to avoid connection timeouts

// ── HELPERS ─────────────────────────────────────────────────────────────────

function scheduleTime(index) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(FIRST_HOUR, 0, 0, 0);
  return new Date(d.getTime() + index * HOURS_GAP * 3_600_000);
}

function readTime(body) {
  return Math.max(1, Math.ceil((body || '').split(/\s+/).length / 200));
}

function patchLinks(body) {
  // Replace placeholder domain with real site URL
  return (body || '')
    .replace(/https?:\/\/yourdomain\.com/g, SITE_URL)
    .replace(/\${SITE_URL}/g, SITE_URL);
}

// ── CATEGORY MAP ─────────────────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { slug: 'beginner-guides',  name: 'Beginner Guides',           desc: 'Start here — everything new readers need to know about manga, manhwa, and manhua.' },
  { slug: 'rankings',         name: 'Rankings',                  desc: 'Definitive ranked lists of the best manga and manhwa across every genre.' },
  { slug: 'reading-guides',   name: 'Reading Guides',            desc: '"If you liked X, read these" — curated recommendations based on what you already love.' },
  { slug: 'genre-guides',     name: 'Genre Guides',              desc: 'Deep dives into manga genres — from fantasy and romance to isekai, murim, and dark fantasy.' },
  { slug: 'reading-order',    name: 'Reading Order Guides',      desc: 'Complete reading order guides for major manga and manhwa series.' },
  { slug: 'high-traffic',     name: 'Top Topics',                desc: 'High-demand topics: overpowered MCs, dark fantasy, school life, revenge arcs, and more.' },
];

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Blog Import — 326 Articles');
  console.log(`   Site URL : ${SITE_URL}`);
  console.log(`   Schedule : every ${HOURS_GAP}h, first post tomorrow at ${FIRST_HOUR}:00 UTC`);
  console.log(`   Last post: ~${Math.round(articles.length * HOURS_GAP / 24)} days from now\n`);

  // ── 1. Ensure author exists ──────────────────────────────────────────────
  const author = await prisma.editorialAuthor.upsert({
    where:  { slug: AUTHOR_SLUG },
    update: {},
    create: {
      slug:        AUTHOR_SLUG,
      name:        'MangaKakalot Editorial Team',
      bio:         'Our editorial team are passionate readers covering manga, manhwa, and manhua with thousands of chapters of combined reading experience.',
      credentials: 'Collective manga & manhwa expertise across all major genres and platforms.',
    },
  });
  console.log(`✅ Author: ${author.name}\n`);

  // ── 2. Ensure categories exist ───────────────────────────────────────────
  const catMap = {};
  for (const def of CATEGORY_DEFS) {
    const cat = await prisma.category.upsert({
      where:  { slug: def.slug },
      update: {},
      create: { slug: def.slug, name: def.name, description: def.desc },
    });
    catMap[def.slug] = cat.id;
  }
  console.log(`✅ Categories: ${Object.keys(catMap).length} ready\n`);

  // ── 3. Import articles ────────────────────────────────────────────────────
  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];

    try {
      // Check if already exists
      const existing = await prisma.article.findUnique({ where: { slug: a.slug } });
      if (existing) {
        process.stdout.write('·');
        skipped++;
        continue;
      }

      // Resolve category
      const categoryId = catMap[a.category] || catMap['reading-guides'];
      const scheduledFor = scheduleTime(i);

      // Ensure tags
      const tagConnects = [];
      if (a.tags && a.tags.length) {
        for (const tagName of a.tags) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const tag = await prisma.articleTag.upsert({
            where:  { slug: tagSlug },
            update: {},
            create: { slug: tagSlug, name: tagName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
          });
          tagConnects.push({ id: tag.id });
        }
      }

      const body = patchLinks(a.body);

      await prisma.article.create({
        data: {
          slug:           a.slug,
          title:          a.title,
          excerpt:        (a.excerpt || '').slice(0, 500),
          body,
          coverImage:     a.coverImage || null,
          contentType:    a.contentType || 'BLOG',
          status:         'SCHEDULED',
          scheduledFor,
          publishedAt:    scheduledFor,
          seoTitle:       (a.seoTitle || a.title).slice(0, 70),
          seoDescription: (a.seoDescription || a.excerpt || '').slice(0, 160),
          canonicalUrl:   `${SITE_URL}/blog/${a.slug}`,
          readingMinutes: readTime(body),
          bylineId:       author.id,
          categoryId,
          tags:           tagConnects.length ? { connect: tagConnects } : undefined,
        },
      });

      process.stdout.write('✓');
      if ((imported + 1) % 50 === 0) {
        console.log(`\n   [${imported + 1}/${articles.length}] imported so far...`);
      }
      imported++;
    } catch (err) {
      process.stdout.write('✗');
      console.error(`\n   ❌ Error on "${a.title}": ${err.message}`);
      errors++;
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('📊 Import Complete');
  console.log('══════════════════════════════════════════');
  console.log(`   ✅ Imported : ${imported}`);
  console.log(`   ⏭  Skipped  : ${skipped} (already existed)`);
  console.log(`   ❌ Errors   : ${errors}`);
  console.log(`\n   First post publishes : ${scheduleTime(0).toISOString().slice(0, 16)} UTC`);
  console.log(`   Last post publishes  : ${scheduleTime(articles.length - 1).toISOString().slice(0, 16)} UTC`);
  console.log(`   Span                 : ~${Math.round(articles.length * HOURS_GAP / 24)} days`);
  console.log('\n   Posts auto-publish when scheduledFor <= NOW()');
  console.log('   No cron job needed — works with ISR revalidation.\n');

  // Category breakdown
  console.log('   Articles by category:');
  const total = await prisma.article.count();
  const byCat = await prisma.article.groupBy({ by: ['categoryId'], _count: true });
  for (const def of CATEGORY_DEFS) {
    const catId = catMap[def.slug];
    const row = byCat.find(r => r.categoryId === catId);
    console.log(`   ${def.name.padEnd(24)}: ${row?._count ?? 0}`);
  }
  console.log(`\n   Total articles in DB : ${total}`);
}

main()
  .catch(e => { console.error('\n❌ Fatal error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
