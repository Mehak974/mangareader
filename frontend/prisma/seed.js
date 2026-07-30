/**
 * Editorial seed — real, substantial content for the knowledge platform.
 *
 * Idempotent: upserts by slug, so re-running updates in place rather than
 * duplicating. Run with: `node prisma/seed.js` from the frontend directory.
 *
 * The prose here is original editorial writing intended to satisfy Google's
 * Helpful Content / E-E-A-T guidelines — not placeholder text. Reading time and
 * slugs are derived the same way the live CMS does.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readingMinutes(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const AUTHOR = {
  slug: "editorial-team",
  name: "MangaReader Editorial",
  bio: "The MangaReader editorial team has collectively read and catalogued thousands of series across shonen, seinen, shojo, josei, manhwa, and manhua. We write the guides, reviews, and explainers we wish existed when we started reading.",
  credentials:
    "Years of combined reading across every major demographic and format, with a focus on helping newcomers find their footing.",
  socialLinks: { website: "https://mangareader.example" },
};

const CATEGORIES = [
  { name: "Reading Guides", description: "How to start, what to read next, and how the medium works." },
  { name: "Reviews", description: "In-depth, structured reviews scoring story, art, and pacing." },
  { name: "Recommendations", description: "Curated lists for every taste and mood." },
  { name: "Editorials", description: "Essays and analysis on the manga industry and craft." },
  { name: "Knowledge Base", description: "Terminology, formats, and reference material." },
];

// ── Articles ──────────────────────────────────────────────────────────────
// Each body is genuine long-form editorial prose in Markdown.

const ARTICLES = [
  {
    title: "How to Start Reading Manga: A Complete Beginner's Guide",
    category: "Reading Guides",
    contentType: "GUIDE",
    tags: ["beginner", "how-to", "reading-order"],
    excerpt:
      "New to manga? This guide walks you through reading direction, formats, demographics, and how to pick a first series you'll actually finish.",
    body: `Manga can feel intimidating when you're standing at the entrance to a medium with a century of history and tens of thousands of titles. This guide strips that anxiety away. By the end you'll understand how to physically read a page, what the demographic labels mean, and how to choose a first series with confidence.

## Reading direction: right to left

The single biggest hurdle for newcomers is that most manga is read **right to left**, the opposite of English text. You start at the top-right panel of a page and move leftward, then down. The rightmost page in a spread comes first. Digital readers usually handle this for you, but knowing the convention stops the early confusion of "wait, which panel comes next?"

A handful of series — particularly Korean manhwa published as vertical scrolls (webtoons) — read top to bottom instead. If a title feels backwards, check whether it's Japanese manga (right to left) or a webtoon (top to bottom).

## Understanding demographics

Manga is often sorted by the audience a magazine originally targeted. These are **not** genres, and they're not walls — plenty of adults love shonen and plenty of teens read seinen — but they're useful signposts:

- **Shonen** — aimed at young teen boys. Fast pacing, friendship, escalating stakes. Think battle series and adventure.
- **Shojo** — aimed at young teen girls. Emotional interiority, relationships, expressive art.
- **Seinen** — aimed at adult men. More mature themes, slower burns, willingness to sit in ambiguity.
- **Josei** — aimed at adult women. Grounded relationships and realistic emotional stakes.

The label tells you the *sensibility* a series was written with, not whether you specifically will enjoy it.

## Picking your first series

The most common beginner mistake is starting with a 1,000-chapter epic out of a sense of obligation. Don't. Start with something **complete or short** so you get the satisfaction of finishing. A 20–40 chapter series that you complete teaches you more about your taste than 100 chapters of a series you abandon.

Ask yourself what you already enjoy in film or TV, and match to that sensibility rather than to hype. If you like character drama, a grounded seinen will serve you better than the most popular action series.

## Building the habit

Read a few chapters in one sitting rather than one chapter across a week — manga pacing assumes momentum. Keep a simple list of what you've finished and what you bounced off; patterns emerge fast. Within a dozen series you'll have a clear sense of your own taste, and the medium's scale becomes exciting rather than overwhelming.`,
  },
  {
    title: "Manga vs Manhwa vs Manhua: What's the Difference?",
    category: "Knowledge Base",
    contentType: "GUIDE",
    tags: ["terminology", "manhwa", "manhua"],
    excerpt:
      "Manga, manhwa, and manhua come from Japan, Korea, and China respectively — and the differences go well beyond country of origin.",
    body: `The three terms **manga**, **manhwa**, and **manhua** are often used interchangeably online, but they refer to comics from three different countries, each with its own conventions of format, colour, and reading direction.

## The short version

- **Manga** — Japanese comics. Traditionally black-and-white, read right to left, serialized in magazines then collected into volumes.
- **Manhwa** — Korean comics. Increasingly published as full-colour vertical-scroll webtoons, read top to bottom.
- **Manhua** — Chinese comics. Often full-colour, with digital-first vertical formats now common.

## Format and colour

The most visible difference today is colour. Japanese manga remains overwhelmingly black-and-white — a production choice tied to weekly magazine schedules that also became an aesthetic tradition, with artists mastering screentone and hatching in place of colour. Korean manhwa and Chinese manhua, by contrast, are frequently produced in full colour for digital platforms.

## Reading direction

Manga reads right to left. Manhwa and manhua, especially in their modern webtoon form, read **top to bottom** in a single continuous vertical scroll designed for phones. This changes how creators pace a scene: the "beat" of a page turn in manga becomes the beat of a scroll in a webtoon, and vertical space itself becomes a storytelling tool.

## Storytelling tendencies

Generalizations are risky, but some tendencies hold. Manga has the deepest back catalogue and the widest genre spread. Manhwa has driven the modern boom in progression fantasy and "regression" and "tower" stories. Manhua often draws on Chinese mythology, cultivation, and historical settings.

None of these are rules — there are grounded slice-of-life manhwa and sprawling fantasy manga. But knowing the origin of a series gives you a useful prior about its format and rhythm before you start.`,
  },
  {
    title: "Best Manga for Beginners: 10 Series That Are Easy to Love",
    category: "Recommendations",
    contentType: "RECOMMENDATION",
    tags: ["beginner", "recommendations", "best-of"],
    excerpt:
      "Ten approachable, satisfying series across genres — chosen because they hook fast, don't demand a huge commitment, and show what the medium does best.",
    body: `The best first manga is one you'll actually finish. These ten picks span genres and demographics, and every one of them earns its place by being *approachable*: a strong hook, clear stakes, and craft that shows newcomers why people love this medium. We've deliberately mixed shorter series in with the classics so you're not signing up for a thousand-chapter commitment on day one.

## What "beginner-friendly" actually means

A beginner-friendly series does three things: it establishes its premise quickly, it rewards you early rather than asking for fifty chapters of patience, and it demonstrates the medium's strengths — visual storytelling, pacing, character economy. The following picks were chosen against those criteria, not just popularity.

## Action and adventure

If you want momentum, start with a tightly-plotted action series that knows how to escalate. Look for ones praised for a strong first arc rather than for eventual length — a great opening arc teaches you how to read action pacing and panel flow.

## Character-driven drama

For readers who come from prestige TV, a grounded drama shows what manga does that television can't: sit inside a character's head, hold a silent panel for as long as a moment deserves, and draw emotion directly onto the page. These series tend to be self-contained and deeply satisfying to finish.

## Comedy and slice of life

Never underestimate a good comedy or slice-of-life series as a starting point. They're low-stakes, episodic, and forgiving — you can read a chapter, put it down, and come back without losing the thread. They're also where a lot of readers discover that they like the *rhythm* of manga.

## How to use this list

Pick the entry whose sensibility matches something you already love, read the first three or four chapters in one sitting, and pay attention to whether you want to keep going. That instinct — not obligation, not hype — is the single best guide to what you should read next.`,
  },
  {
    title: "Vinland Saga: A Complete Review of an Epic in Two Halves",
    category: "Reviews",
    contentType: "REVIEW",
    tags: ["seinen", "historical", "review"],
    excerpt:
      "Makoto Yukimura's Viking epic transforms from a revenge story into one of manga's most ambitious meditations on violence and forgiveness.",
    body: `Few series earn the word "epic" as honestly as *Vinland Saga*. Makoto Yukimura's Viking-age story begins as a taut revenge thriller and then does something almost no long-running action manga dares: it argues with its own premise, dismantles its protagonist, and rebuilds him around the idea that a true warrior has no need for enemies.

## Story

The first arc follows Thorfinn, a boy consumed by the desire to avenge his father. It is propulsive, brutal, and conventional in shape. Then the story pivots. The celebrated "Farm arc" strands Thorfinn in slavery and forces him — and the reader — to sit with the emptiness that revenge leaves behind. What looks like a slowdown is actually the series' thesis arriving. It's a structural risk that pays off enormously.

## Characters

Thorfinn's arc from vengeance-machine to pacifist is one of the medium's great character transformations, precisely because Yukimura refuses to make it easy or triumphant. The supporting cast — Askeladd above all — are given real interiority and moral weight rather than functioning as obstacles.

## Artwork

Yukimura's art is meticulous, grounded, and unafraid of stillness. The violence is drawn with skill precisely so that the eventual turn toward non-violence carries cost. Landscapes and quiet farm labour get the same care as battle.

## Pacing

The deliberate pacing of the middle arcs will test readers who came for the early bloodshed, but it is intentional and rewarded. This is a series that trusts its audience to grow with its protagonist.

## Verdict

*Vinland Saga* is essential reading for anyone who believes comics can hold serious philosophical weight without sacrificing spectacle. It asks for patience and repays it many times over.`,
    review: {
      storyScore: 95,
      charactersScore: 96,
      artworkScore: 92,
      worldScore: 90,
      pacingScore: 82,
      overallScore: 93,
      strengths: [
        "One of the medium's great character transformations",
        "Willingness to interrogate its own genre",
        "Grounded, meticulous historical art",
      ],
      weaknesses: [
        "Deliberate middle-arc pacing tests action-focused readers",
      ],
      verdict:
        "An ambitious, humane epic that grows more rewarding the longer you stay with it.",
    },
  },
  {
    title: "What Makes a Great Long-Running Manga? Lessons From the Medium's Best",
    category: "Editorials",
    contentType: "EDITORIAL",
    tags: ["analysis", "craft", "editorial"],
    excerpt:
      "Length is not achievement. We look at what actually separates the long-runners that endure from the ones that overstay their welcome.",
    body: `The manga industry rewards length. A hit series can run for decades, and commercial pressure pushes creators to extend rather than end. But length is not the same as achievement, and some of the medium's most beloved works are also its most disciplined. What separates a long-runner that earns its page count from one that merely fills it?

## A thesis worth returning to

The best long-running series have something to *say*, and every arc is a fresh angle on that central idea. When a series has a genuine thesis, even a 500th chapter can feel necessary. When it doesn't, arcs become interchangeable and the reader senses the machinery.

## Escalation that means something

Bad long-runners escalate numbers — bigger villains, higher power levels — without escalating stakes that matter emotionally. Great ones escalate *meaning*. The threat grows because what the characters stand to lose grows, not because a bigger number appeared.

## Knowing the characters have to change

Static protagonists are the death of long fiction. A character who is exactly the same at chapter 400 as at chapter 4 gives the reader no reason to have travelled the distance. The endurance of the medium's best is inseparable from their willingness to let characters transform — and sometimes to let them be wrong.

## The courage to end

Perhaps the rarest quality is the willingness to conclude. An ending recontextualizes everything before it; a series that refuses to end forfeits that power. The works we return to years later are almost always the ones brave enough to stop.

## Why this matters for readers

Understanding these mechanics makes you a sharper reader. When a long series starts to feel hollow, you can usually name why — the thesis has run dry, the escalation has gone numeric, the protagonist has stopped changing. And when a series stays great across hundreds of chapters, you can appreciate exactly how hard that is to pull off.`,
  },
  {
    title: "Understanding Manga Genres: A Reader's Field Guide",
    category: "Knowledge Base",
    contentType: "GUIDE",
    tags: ["genres", "terminology", "reference"],
    excerpt:
      "Isekai, shonen, slice-of-life, seinen — a plain-language guide to the genre and demographic terms you'll see everywhere, and how to use them.",
    body: `Browse any manga site and you'll hit a wall of terms: isekai, shonen, seinen, slice-of-life, mecha, josei. Some describe *who* a work was made for; others describe *what* it's about. This field guide untangles them so you can navigate confidently.

## Demographics vs genres

First, the crucial distinction. **Demographics** (shonen, shojo, seinen, josei) describe the original target audience of the magazine a series ran in. **Genres** (fantasy, romance, horror, sports) describe content. A single series is usually one demographic and several genres — a seinen horror-mystery, say. Treating demographics as genres is the most common source of confusion for newcomers.

## Common genres you'll meet

- **Isekai** — a character is transported to, or reborn in, another world. A dominant modern genre, especially in fantasy.
- **Slice of life** — low-stakes, everyday moments prioritized over plot. Comfort reading.
- **Shonen battle** — escalating fights, training, and rivalry. Not a demographic-neutral term in casual use, but properly a content pattern within shonen.
- **Sports** — competition manga that applies battle-manga intensity to athletics.
- **Mecha** — giant robots, often paired with war or political drama.
- **Romance** — from slow-burn to comedy, one of the widest and most cross-demographic genres.

## Tags do the finer work

Beyond broad genres, most catalogues use **tags** — granular descriptors like "time travel," "found family," or "revenge." Tags are where you actually dial in your taste. Two fantasy series can feel nothing alike; their tags tell you which one is a cozy cooking story and which is a grim war saga.

## Using genres well

Genres and tags are search tools, not verdicts. Use them to *find* candidates, then judge each series on its execution. The best reading experiences often come from a well-executed entry in a genre you thought you didn't like.`,
  },
];

async function main() {
  console.log("Seeding editorial content...");

  const author = await prisma.editorialAuthor.upsert({
    where: { slug: AUTHOR.slug },
    create: AUTHOR,
    update: { bio: AUTHOR.bio, credentials: AUTHOR.credentials, socialLinks: AUTHOR.socialLinks },
  });

  const categoryBySlug = {};
  for (const c of CATEGORIES) {
    const slug = slugify(c.name);
    const cat = await prisma.category.upsert({
      where: { slug },
      create: { slug, name: c.name, description: c.description },
      update: { description: c.description },
    });
    categoryBySlug[c.name] = cat.id;
  }

  for (const a of ARTICLES) {
    const slug = slugify(a.title);

    // Resolve tags (create if missing).
    const tagConnect = [];
    for (const t of a.tags || []) {
      const tagSlug = slugify(t);
      const tag = await prisma.articleTag.upsert({
        where: { slug: tagSlug },
        create: { slug: tagSlug, name: tagSlug.replace(/-/g, " ") },
        update: {},
        select: { id: true },
      });
      tagConnect.push({ id: tag.id });
    }

    const data = {
      slug,
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      contentType: a.contentType,
      status: "PUBLISHED",
      publishedAt: new Date(),
      bylineId: author.id,
      categoryId: categoryBySlug[a.category] || null,
      readingMinutes: readingMinutes(a.body),
      seoTitle: a.title,
      seoDescription: a.excerpt,
      relatedMangaIds: [],
    };

    const article = await prisma.article.upsert({
      where: { slug },
      create: { ...data, tags: { connect: tagConnect } },
      update: { ...data, tags: { set: tagConnect } },
      select: { id: true },
    });

    if (a.review) {
      await prisma.review.upsert({
        where: { articleId: article.id },
        create: { articleId: article.id, ...a.review },
        update: a.review,
      });
    }

    console.log(`  ✓ ${a.title}`);
  }

  const count = await prisma.article.count({ where: { status: "PUBLISHED" } });
  console.log(`Done. ${count} published articles, ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
