export const COVER_GRADS = [
  'linear-gradient(160deg,#3a1f5c,#1a0a2e)',
  'linear-gradient(160deg,#5c1f3a,#2e0a1a)',
  'linear-gradient(160deg,#1f3a5c,#0a1a2e)',
  'linear-gradient(160deg,#3a5c1f,#0a2e1a)',
  'linear-gradient(160deg,#5c3a1f,#2e1a0a)',
  'linear-gradient(160deg,#2a1f5c,#0a0a2e)'
];

export const MANGA = [];

export const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Dark Fantasy', 'Drama', 'Fantasy', 'Historical', 'Horror',
  'Isekai', 'Martial Arts', 'Mecha', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Seinen',
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Tragedy'
];

export const GENRE_MAP = {};

export const CH_TITLES = [];

export const ALL_CHAPTERS = [];

export const completedReadingData = [];

export const recentData = [];

export const achievements = [
  { icon: '📖', name: 'First Chapter', desc: 'Read your first chapter', earned: true },
  { icon: '🔥', name: 'On a Roll', desc: '7-day streak', earned: true },
  { icon: '⭐', name: 'Critic', desc: 'Rated 50+ titles', earned: true },
  { icon: '📚', name: 'Bookworm', desc: '100 chapters', earned: true },
  { icon: '🌙', name: 'Night Owl', desc: 'Read past midnight', earned: true },
  { icon: '🗺️', name: 'Explorer', desc: '10 different genres', earned: false },
  { icon: '👑', name: 'Champion', desc: 'Top 1% readers', earned: false },
  { icon: '✍️', name: 'Storyteller', desc: 'Write 5 reviews', earned: false }
];

export const blogPosts = [
  { id: 'vinland-saga-analysis', cat: 'Analysis', title: 'Why Vinland Saga\'s second arc is one of the greatest in manga history', excerpt: 'Beneath the quietude lies Yukimura\'s most ambitious storytelling — a meditation on violence, freedom, and what it means to be human.', date: 'Jul 8, 2026', author: 'Editorial Team', time: '9 min', views: '4,200' },
  { id: 'chainsaw-man-review', cat: 'Review', title: 'Chainsaw Man Part 2 is angrier, stranger, and better', meta: 'Staff · Jul 7 · 7 min', excerpt: 'Fujimoto continues to defy expectations with a sequel that values character trauma over action beats.', date: 'Jul 7, 2026', author: 'Staff', time: '7 min' },
  { id: 'best-first-chapters', cat: 'Lists', title: 'The 15 best first chapters in manga — ranked', meta: 'Community · Jul 6 · 5 min', excerpt: 'First impressions matter. Here are the opening chapters that hooked us instantly.', date: 'Jul 6, 2026', author: 'Community', time: '5 min' },
  { id: 'berserk-influence', cat: 'Analysis', title: 'How Berserk influenced a generation of dark fantasy', meta: 'Editorial · Jul 4 · 11 min', excerpt: 'Tracing the shadow cast by Kentaro Miura\'s masterpiece on modern manga, games, and literature.', date: 'Jul 4, 2026', author: 'Editorial Team', time: '11 min' },
  { id: 'blue-lock-season-3', cat: 'News', title: 'Blue Lock anime season 3 confirmed for 2027', meta: 'News · Jul 3 · 2 min', excerpt: 'Egoists rejoice: the next selection arc is officially getting animated.', date: 'Jul 3, 2026', author: 'News', time: '2 min' },
  { id: 'where-to-start-manga', cat: 'Guides', title: 'Where to start with manga: a no-fluff guide', meta: 'Editorial · Jul 1 · 8 min', excerpt: 'New to the medium? Here are our top recommendations categorized by genre and experience.', date: 'Jul 1, 2026', author: 'Editorial Team', time: '8 min' },
  { id: 'translators-interview', cat: 'Interview', title: 'The translators keeping lesser-known manga alive', meta: 'Community · Jun 28 · 10 min', excerpt: 'We talk to fan translation groups about their passion, challenges, and favorite hidden gems.', date: 'Jun 28, 2026', author: 'Community', time: '10 min' }
];

export const faqs = [
  { q: 'Is MangaReader free?', a: 'Yes, completely free. No ads, no paywalls. We are supported by voluntary donations from readers.' },
  { q: 'Do I need an account to read?', a: 'No. You can read without an account. However, signing up lets you track progress, bookmark chapters, and sync across devices.' },
  { q: 'What is Incognito Mode?', a: 'When Incognito is active, nothing you read is saved to your history. It is session-only — close the app and everything is gone.' },
  { q: 'How do I enable NSFW content?', a: 'Go to Settings → Content → NSFW Content. You must confirm you are 18 or older. The toggle is off by default.' },
  { q: 'Can I hide certain genres?', a: 'Yes. Right-click any manga card and choose "Hide [genre] manga". You can manage hidden genres in Settings → Content.' },
  { q: 'How does chapter pagination work?', a: 'The chapter list on a manga detail page shows 20 chapters per page, newest first. Use the page buttons at the bottom to navigate.' },
  { q: 'How do I report a broken chapter?', a: 'Use the Contact Us page and select "Content issue" as the subject.' }
];

export const abbr = (t) => (t || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
