/**
 * Article Parser — extracts all 335 blog posts from uploaded markdown files.
 * Run: node parse-articles.js
 * Output: articles-data.json (ready for import-blogs.js)
 */

const fs = require('fs');
const path = require('path');

const UPLOADS = '/mnt/user-data/uploads';
const OUT = path.join(__dirname, 'articles-data.json');

function slug(str) {
  return str.toLowerCase()
    .replace(/[''""]/g, '').replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 100);
}

function readTime(body) { return Math.max(1, Math.ceil(body.split(/\s+/).length / 200)); }

function contentType(title) {
  const t = title.toLowerCase();
  if (/reading order|how to|how manga|how long|what is|what are|what does|explained|complete guide|beginner|serialization|publishing|adapted|became popular|format is better/.test(t)) return 'GUIDE';
  if (/best |top |ranked|if you like|read these|recommendations|most anticipated|most underrated/.test(t)) return 'RECOMMENDATION';
  return 'BLOG';
}

function inferTags(title, cat) {
  const t = (title + ' ' + cat).toLowerCase();
  const map = {
    'manga': 'manga', 'manhwa': 'manhwa', 'manhua': 'manhua', 'webtoon': 'webtoon',
    'romance': 'romance', 'fantasy': 'fantasy', 'action': 'action', 'horror': 'horror',
    'thriller': 'thriller', 'isekai': 'isekai', 'murim': 'murim', 'cultivation': 'cultivation',
    'shonen': 'shonen', 'seinen': 'seinen', 'shojo': 'shojo', 'josei': 'josei',
    'beginner': 'beginner-guide', 'reading order': 'reading-order', 'guide': 'reading-guide',
    'ranked': 'rankings', 'best ': 'recommendations',
    'one piece': 'one-piece', 'naruto': 'naruto', 'bleach': 'bleach',
    'solo leveling': 'solo-leveling', 'attack on titan': 'attack-on-titan',
    'demon slayer': 'demon-slayer', 'jujutsu kaisen': 'jujutsu-kaisen',
    'berserk': 'berserk', 'adventure': 'adventure', 'dark fantasy': 'dark-fantasy',
    'psychological': 'psychological', 'mystery': 'mystery', 'comedy': 'comedy',
    'sports': 'sports', 'martial arts': 'martial-arts', 'overpowered': 'overpowered-mc',
    'villainess': 'villainess', 'school': 'school-life', 'historical': 'historical',
    'completed': 'completed', 'ongoing': 'ongoing', 'survival': 'survival',
    'regression': 'regression', 'revenge': 'revenge', 'dungeon': 'dungeon',
  };
  const found = [];
  for (const [kw, tag] of Object.entries(map)) { if (t.includes(kw)) found.push(tag); }
  return [...new Set(found)].slice(0, 8);
}

function inferCover(title) {
  const t = title.toLowerCase();
  const coverMap = [
    ['one piece', '/blog-covers/one-piece.webp'],
    ['naruto', '/blog-covers/naruto.webp'],
    ['bleach', '/blog-covers/bleach.webp'],
    ['dragon ball', '/blog-covers/dragon-ball.webp'],
    ['solo leveling', '/blog-covers/solo-leveling.webp'],
    ['attack on titan', '/blog-covers/attack-on-titan.webp'],
    ['demon slayer', '/blog-covers/demon-slayer.webp'],
    ['jujutsu kaisen', '/blog-covers/jujutsu-kaisen.webp'],
    ['berserk', '/blog-covers/berserk.webp'],
    ['fullmetal alchemist', '/blog-covers/fullmetal-alchemist.webp'],
    ['hunter x hunter', '/blog-covers/hunter-x-hunter.webp'],
    ['hunter × hunter', '/blog-covers/hunter-x-hunter.webp'],
    ['vinland saga', '/blog-covers/vinland-saga.webp'],
    ['frieren', '/blog-covers/frieren.webp'],
    ['chainsaw man', '/blog-covers/chainsaw-man.webp'],
    ['my hero academia', '/blog-covers/my-hero-academia.webp'],
    ['black clover', '/blog-covers/black-clover.webp'],
    ['spy x family', '/blog-covers/spy-x-family.webp'],
    ['haikyu', '/blog-covers/haikyu.webp'],
    ['blue lock', '/blog-covers/blue-lock.webp'],
    ['kaguya', '/blog-covers/kaguya-sama.webp'],
    ['horimiya', '/blog-covers/horimiya.webp'],
    ['fruits basket', '/blog-covers/fruits-basket.webp'],
    ['omniscient reader', '/blog-covers/omniscient-readers-viewpoint.webp'],
    ['tower of god', '/blog-covers/tower-of-god.webp'],
    ['death note', '/blog-covers/death-note.webp'],
    ['one punch man', '/blog-covers/one-punch-man.webp'],
    ['mob psycho', '/blog-covers/mob-psycho-100.webp'],
    ['vagabond', '/blog-covers/vagabond.webp'],
    ['kingdom', '/blog-covers/kingdom.webp'],
    ['slam dunk', '/blog-covers/slam-dunk.webp'],
    ['made in abyss', '/blog-covers/made-in-abyss.webp'],
    ['dr. stone', '/blog-covers/dr-stone.webp'],
    ['romance', '/blog-covers/romance-manga.webp'],
    ['fantasy', '/blog-covers/fantasy-manga.webp'],
    ['action', '/blog-covers/action-manga.webp'],
    ['horror', '/blog-covers/horror-manga.webp'],
    ['thriller', '/blog-covers/thriller-manga.webp'],
    ['isekai', '/blog-covers/isekai-manga.webp'],
    ['adventure', '/blog-covers/adventure-manga.webp'],
    ['murim', '/blog-covers/murim.webp'],
    ['shonen', '/blog-covers/shonen-manga.webp'],
    ['seinen', '/blog-covers/seinen-manga.webp'],
    ['shojo', '/blog-covers/shojo-manga.webp'],
    ['manhwa', '/blog-covers/best-manhwa.webp'],
    ['manhua', '/blog-covers/manhua.webp'],
    ['webtoon', '/blog-covers/webtoon.webp'],
    ['beginner', '/blog-covers/beginners-guide-manga.webp'],
    ['how to start', '/blog-covers/beginners-guide-manga.webp'],
    ['reading order', '/blog-covers/reading-order-guide.webp'],
    ['ranked', '/blog-covers/best-manga-all-time.webp'],
    ['best manga of all time', '/blog-covers/best-manga-all-time.webp'],
    ['overpowered', '/blog-covers/op-mc.webp'],
    ['villainess', '/blog-covers/villainess.webp'],
    ['martial arts', '/blog-covers/martial-arts.webp'],
    ['sports', '/blog-covers/sports-manga.webp'],
    ['psychological', '/blog-covers/psychological-manga.webp'],
    ['school', '/blog-covers/school-life.webp'],
    ['historical', '/blog-covers/historical-manga.webp'],
    ['cultivation', '/blog-covers/cultivation.webp'],
    ['dark fantasy', '/blog-covers/dark-fantasy.webp'],
    ['revenge', '/blog-covers/revenge.webp'],
    ['survival', '/blog-covers/survival.webp'],
    ['dungeon', '/blog-covers/dungeon.webp'],
    ['completed', '/blog-covers/completed-manga.webp'],
    ['serialization', '/blog-covers/manga-industry.webp'],
    ['publishing', '/blog-covers/manga-industry.webp'],
    ['adapted', '/blog-covers/manga-anime.webp'],
    ['urasawa', '/blog-covers/naoki-urasawa.webp'],
    ['miura', '/blog-covers/berserk.webp'],
    ['oda', '/blog-covers/one-piece.webp'],
    ['shueisha', '/blog-covers/shueisha.webp'],
  ];
  for (const [kw, img] of coverMap) { if (t.includes(kw)) return img; }
  return '/blog-covers/manga-guide.webp';
}

function makeExcerpt(body) {
  return body.replace(/^#{1,6}\s*.+/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[*_`|>#]/g, '').replace(/\n+/g, ' ').trim().slice(0, 280);
}

function article(title, body, category) {
  const s = slug(title);
  const ex = makeExcerpt(body);
  return {
    title,
    slug: s,
    excerpt: ex,
    body: body.startsWith('#') ? body : `# ${title}\n\n${body}`,
    category,
    contentType: contentType(title),
    tags: inferTags(title, category),
    coverImage: inferCover(title),
    seoTitle: title.length > 60 ? title.slice(0, 57) + '...' : title,
    seoDescription: ex.slice(0, 160),
  };
}

// ── PARSERS ─────────────────────────────────────────────────────────────────

function parseBeginner(content) {
  return content.split(/^# Article \d+:\s*/m).slice(1).map(chunk => {
    const lines = chunk.split('\n');
    const title = lines[0].trim();
    const slugMatch = chunk.match(/\*\*SEO Slug:\*\*\s*`([^`]+)`/);
    const metaMatch = chunk.match(/\*\*Meta Description:\*\*\s*(.+)/);
    const s = slugMatch ? slugMatch[1] : slug(title);
    const cleanBody = chunk.split('\n').slice(1).join('\n')
      .replace(/\*\*SEO Slug:\*\*[^\n]*/g, '')
      .replace(/\*\*Meta Description:\*\*[^\n]*/g, '')
      .replace(/\*\*Author:\*\*[^\n]*/g, '')
      .replace(/\*\*Published:\*\*[^\n]*/g, '')
      .replace(/\*\*Category:\*\*[^\n]*/g, '')
      .replace(/\*\*Schema:\*\*[^\n]*/g, '')
      .replace(/\*\*FEATURED IMAGE\*\*[\s\S]*?(?=^---$|\n#)/m, '')
      .replace(/\*\*COVER IMAGES[^*]*\*\*[\s\S]*?(?=^---$|\n#)/m, '')
      .trim();
    const ex = metaMatch ? metaMatch[1].trim().slice(0, 280) : makeExcerpt(cleanBody);
    return { title, slug: s, excerpt: ex,
      body: `# ${title}\n\n${cleanBody}`, category: 'beginner-guides',
      contentType: contentType(title), tags: inferTags(title, 'beginner-guides'),
      coverImage: inferCover(title),
      seoTitle: title.length > 60 ? title.slice(0, 57) + '...' : title,
      seoDescription: ex.slice(0, 160) };
  });
}

function parseRanking(content) {
  return content.split(/^# Blog \d+[^\n]*\n/m).slice(1).map(chunk => {
    const m = chunk.match(/^## (.+)/m);
    if (!m) return null;
    const title = m[1].trim();
    const body = chunk.slice(chunk.indexOf(m[0])).replace(/^!\[Cover\][^\n]*\n/m, '').trim();
    return article(title, body, 'rankings');
  }).filter(Boolean);
}

function parseIfYouLike(content) {
  return content.split(/^## (?:Blog \d+ — |If You Liked )/m).slice(1).map(chunk => {
    const firstLine = chunk.split('\n')[0].trim();
    const title = /^Blog \d+/.test(firstLine)
      ? firstLine.replace(/^Blog \d+ — /, '')
      : `If You Liked ${firstLine}`;
    if (!title || title.length < 5) return null;
    const body = chunk.slice(firstLine.length).trim();
    return article(title, `# ${title}\n\n${body}`, 'reading-guides');
  }).filter(Boolean);
}

function parseGenre(content) {
  const articles = [];
  // 1. Numbered main sections: ## N. Title
  content.split(/^## \d+\. /m).slice(1).forEach(chunk => {
    const title = chunk.split('\n')[0].trim();
    if (!title || title.length < 5) return;
    articles.push(article(title, `# ${title}\n\n${chunk.slice(title.length).trim()}`, 'genre-guides'));
  });
  // 2. "## Blog N: If You Like..." embedded sections
  content.split(/^## Blog \d+:\s*/m).slice(1).forEach(chunk => {
    const title = chunk.split('\n')[0].trim();
    if (!title || title.length < 5) return;
    articles.push(article(title, `# ${title}\n\n${chunk.slice(title.length).trim()}`, 'genre-guides'));
  });
  // 3. "## 10 X" romance/action sub-guides
  const romSection = content.indexOf('## Romance Reading Guides') > -1
    ? content.slice(content.indexOf('## Romance Reading Guides'))
    : content;
  romSection.split(/^## 10 /m).slice(1).forEach(chunk => {
    const title = '10 ' + chunk.split('\n')[0].trim();
    if (!title || title.length < 5) return;
    articles.push(article(title, `# ${title}\n\n${chunk.slice(chunk.indexOf('\n')).trim()}`, 'genre-guides'));
  });
  return articles;
}

function parseIndustry(content) {
  const articles = [];
  // Split on top-level numbered headings: "# 1. Title", "# 2. Title" etc.
  const chunks = content.split(/^# \d+\. /m);
  for (let i = 1; i < chunks.length; i++) {
    const lines = chunks[i].split('\n');
    const title = lines[0].trim();
    if (!title || title.length < 5) continue;
    const rawBody = `# ${title}\n\n${lines.slice(1).join('\n').trim()}`;
    // Trim at next article boundary if oversized
    const trimmed = rawBody.length > 20000
      ? rawBody.slice(0, 20000).split('\n\n').slice(0, -1).join('\n\n').trim()
      : rawBody;
    articles.push(article(title, trimmed, 'genre-guides'));
  }
  return articles;
}

function parseReadingOrder(content) {
  return content.split(/^## \d+\. /m).slice(1).map(chunk => {
    const title = chunk.split('\n')[0].trim();
    if (!title || title.length < 5) return null;
    return article(title, `# ${title}\n\n${chunk.slice(title.length).trim()}`, 'reading-order');
  }).filter(Boolean);
}

function parseBonus(content) {
  return content.split(/^# Blog \d+ — /m).slice(1).map(chunk => {
    const firstLine = chunk.split('\n')[0].trim();
    if (!firstLine || firstLine.length < 5) return null;
    return article(firstLine, chunk.slice(firstLine.length).trim(), 'high-traffic');
  }).filter(Boolean);
}

// ── MAIN ────────────────────────────────────────────────────────────────────

const FILES = [
  { file: 'Beginner_Guides.md',                 parser: parseBeginner,     label: 'Beginner Guides',    expected: 15  },
  { file: 'Ranking_60.md',                      parser: parseRanking,      label: 'Rankings',           expected: 60  },
  { file: 'If_You_Like_Complete.md',             parser: parseIfYouLike,    label: 'If You Like',        expected: 110 },
  { file: 'Genre_Based.md',                     parser: parseGenre,        label: 'Genre Based',        expected: 80  },
  { file: 'Genre_Industry_Individual_Guides.md', parser: parseIndustry,    label: 'Industry Guides',    expected: 20  },
  { file: 'Reading_Order_Guides.md',            parser: parseReadingOrder, label: 'Reading Orders',     expected: 30  },
  { file: 'Bonus_High-Traffic_Topics.md',       parser: parseBonus,        label: 'Bonus Topics',       expected: 20  },
];

const all = [];
const seen = new Set();

for (const { file, parser, label, expected } of FILES) {
  const fp = path.join(UPLOADS, file);
  if (!fs.existsSync(fp)) { console.warn(`⚠️  Missing: ${file}`); continue; }
  const raw = fs.readFileSync(fp, 'utf8');
  const parsed = parser(raw).filter(a => a && a.slug && a.slug.length >= 3 && a.title.length >= 5);

  let added = 0;
  for (const a of parsed) {
    let s = a.slug;
    if (seen.has(s)) { let n = 2; while (seen.has(`${s}-${n}`)) n++; a.slug = `${s}-${n}`; }
    seen.add(a.slug);
    all.push(a);
    added++;
  }
  const ok = added === expected ? '✅' : '⚠️ ';
  console.log(`${ok} ${label}: ${added} (expected ${expected})`);
}

console.log(`\n📊 Total: ${all.length} articles`);
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`✅ Saved to articles-data.json`);
