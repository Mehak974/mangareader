import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ALL_GENRES, abbr } from "@/data/mockData";
import { slugify } from "@/utils/slugify";
import { getMangaList, isExplicitNSFW } from "@/utils/anilist";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";
import HomeGenreFilter from "@/components/HomeGenreFilter";
import HomeAuthNudge from "@/components/HomeAuthNudge";
import AdCashBanner from "@/components/AdCashBanner";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const revalidate = 300; // Revalidate every 5 minutes

// Server components can be async
export default async function Home() {
  // Set a 5-second timeout for the backend fetch so it doesn't hang the Vercel build
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

const proxyImage = (url) => {
  if (!url || url.startsWith('/')) return url;
  return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`;
};

  const [popularNowRes, trendingRes, popularOverallRes, recentRes] = await Promise.all([
    getMangaList({ perPage: 20, genre: "Fantasy", countryOfOrigin: "KR", sort: ["POPULARITY_DESC"] }),
    getMangaList({ perPage: 24, sort: ["TRENDING_DESC"] }),
    getMangaList({ perPage: 24, sort: ["POPULARITY_DESC"] }),
    fetch(`${apiBase}/api/home`, { signal: controller.signal })
      .then(r => { clearTimeout(timeoutId); return r.json(); })
      .catch((err) => { clearTimeout(timeoutId); console.warn("Backend fetch failed/timed out:", err.message); return { data: [] }; })
  ]);

  let popularNow = popularNowRes?.media?.length > 0
    ? popularNowRes.media
    : [];

  let trending = trendingRes?.media?.length > 0
    ? trendingRes.media
    : [];

  let popularOverall = popularOverallRes?.media?.length > 0
    ? popularOverallRes.media
    : [];

  let recentlyAdded = [];
  if (recentRes?.data && recentRes.data.length > 0) {
    const allRecentItems = [];
    for (const section of recentRes.data) {
      if (section.items) {
        section.items.forEach(item => {
          allRecentItems.push({ ...item, sourceId: section.sourceId });
        });
      }
    }
    recentlyAdded = allRecentItems.slice(0, 20).map(m => ({
      id: m.href || m.title,
      t: m.title,
      cover: m.cover,
      ch: m.chapter || 'Ch 1',
      g: 'Ongoing',
      latest_source: m.sourceId,
      hot: true
    }));
  }

  if (recentlyAdded.length < 20) {
    const recentFallback = await getMangaList({ perPage: 20, sort: ["UPDATED_AT_DESC"] }).catch(() => ({ media: [] }));
    const fallbackMedia = recentFallback?.media?.length > 0
      ? recentFallback.media
      : [];

    const existingTitles = new Set(recentlyAdded.map(m => (m.t || m.title || "").toLowerCase()));
    const uniqueFallback = fallbackMedia.filter(m => !existingTitles.has((m.t || m.title || "").toLowerCase()));
    recentlyAdded = [...recentlyAdded, ...uniqueFallback].slice(0, 20);
  }

  // Filter out NSFW
  const nsfwCheck = (m) => isExplicitNSFW(m.genres || (m.g ? [m.g] : []), m.t || m.title || "", { tags: m.tags, isAdult: m.isAdult });

  let finalPopularNow = popularNow.filter(m => !nsfwCheck(m)).slice(0, 9);
  let finalTrending = trending.filter(m => !nsfwCheck(m)).slice(0, 12);
  let finalPopularOverall = popularOverall.filter(m => !nsfwCheck(m)).slice(0, 12);
  const finalRecentlyAdded = recentlyAdded.filter(m => !nsfwCheck(m)).slice(0, 10);

  const fallbackHero1 = {
    id: "fallback-solo-leveling",
    t: "Solo Leveling",
    title: "Solo Leveling",
    cover: "https://i.pinimg.com/736x/55/be/88/55be884b487e78bf1f329d9927a3ffb2.jpg",
    rating: 9.8,
    ch: "Ch 200",
    ongoing: false,
  };
  const fallbackHero2 = {
    id: "fallback-one-piece",
    t: "One Piece",
    title: "One Piece",
    cover: "https://i.pinimg.com/736x/15/26/bb/1526bb11c465be3119bb71279f4e750b.jpg",
    rating: 9.9,
    ch: "Ch 1100",
    ongoing: true,
  };

  const emergencyFallbacks = [fallbackHero1, fallbackHero2, ...finalRecentlyAdded];

  if (finalPopularNow.length === 0) finalPopularNow = emergencyFallbacks.slice(0, 9);
  if (finalTrending.length === 0) finalTrending = emergencyFallbacks.slice(0, 12);
  if (finalPopularOverall.length === 0) finalPopularOverall = emergencyFallbacks.slice(0, 12);

  const featuredHero = finalPopularNow[0];
  const desktopHero = finalTrending[0];

  return (
    <div>
      {/* MOBILE HERO VIEWPORT */}
      <div className="mob-hero">
        {featuredHero ? (
          <Link href={`/manga/${slugify(featuredHero.t || featuredHero.title)}`} className="mob-resume" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              className="mob-cov"
              style={
                featuredHero.cover
                  ? { position: "relative", overflow: "hidden" }
                  : {}
              }
            >
              {featuredHero.cover ? (
                <Image
                  src={proxyImage(featuredHero.cover)}
                  alt={`Cover for ${featuredHero.t}`}
                  fill
                  sizes="100vw"
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  priority
                  
                />
              ) : (
                "表"
              )}
            </div>
            <div className="mob-resume-info">
              <div className="mob-eyebrow">🔥 Trending #1</div>
              <div className="mob-resume-title">{featuredHero.t}</div>
              <div className="mob-resume-sub">
                ★ {featuredHero.rating.toFixed(1)} · {featuredHero.ch} · {featuredHero.ongoing ? "Ongoing" : "Completed"}
              </div>
            </div>
            <div className="mob-play" style={{ background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", width: "24px", height: "24px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </Link>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>Loading hero...</div>
        )}
      </div>

      {/* DESKTOP/TABLET HERO VIEWPORT */}
      <section className="hero">
        <div>
          <div className="eyebrow">Reading, elevated</div>
          <h1>
            Your manga.
            <br />
            <span className="ac">Beautifully</span>
            <br />
            anywhere.
          </h1>
          <p className="hero-sub">
            Sync reading across devices. Bookmark chapters, track progress, discover new series — without ads.
          </p>
          <div className="hero-btns">
            <Link href="/browse" className="btn btn-p" style={{ textDecoration: 'none' }}>
              Start Reading
            </Link>
            <Link href="/browse" className="btn btn-s" style={{ textDecoration: 'none' }}>
              Browse Titles
            </Link>
          </div>
          <div className="stat-strip">
            <div className="stat-item">
              <b>52,000+</b>
              <span>Chapters</span>
            </div>
            <div className="stat-item">
              <b>3,400+</b>
              <span>Titles</span>
            </div>
            <div className="stat-item">
              <b>128K</b>
              <span>Online now</span>
            </div>
          </div>
        </div>

        {desktopHero && (
          <Link href={`/manga/${slugify(desktopHero.t || desktopHero.title)}`} className="hero-stack" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="hc-back"></div>
            <div className="hc-mid"></div>
            <div className="hc-front">
              <div
                className="hc-img"
                style={
                  desktopHero.cover
                    ? { position: "relative", overflow: "hidden" }
                    : {}
                }
              >
                {desktopHero.cover ? (
                  <Image
                    src={proxyImage(desktopHero.cover)}
                    alt={`Cover for ${desktopHero.t}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: "cover", objectPosition: "center" }}
                    priority
                    
                  />
                ) : (
                  "表紙"
                )}
                <div className="hc-rating" style={{ position: "relative", zIndex: 1 }}>★ {desktopHero.rating.toFixed(1)}</div>
              </div>
              <div className="hc-info">
                <div className="hc-title">{desktopHero.t}</div>
                <div className="hc-ch">{desktopHero.ch} · {desktopHero.ongoing ? "Ongoing" : "Completed"}</div>
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* CONTINUOUS STRIP ROW (POPULAR RIGHT NOW - 7 ITEMS) */}
      {finalPopularNow.length > 0 && (
        <div className="now-bar">
          <div className="bar-label">Popular Right Now</div>
          <div className="reading-list">
            {finalPopularNow.map((r) => (
              <Link href={`/manga/${slugify(r.t || r.title)}`} key={r.id} className="r-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  className="r-cov"
                  style={
                    r.cover
                      ? { position: "relative", overflow: "hidden" }
                      : {}
                  }
                >
                  {r.cover ? (
                    <Image
                      src={proxyImage(r.cover)}
                      alt={`Cover for ${r.t}`}
                      fill
                      sizes="60px"
                      style={{ objectFit: "cover", objectPosition: "center" }}
                      
                    />
                  ) : (
                    abbr(r.t)
                  )}
                </div>
                <div className="r-info">
                  <div className="r-title">{r.t}</div>
                  <div className="r-bar">
                    <div className="r-fill" style={{ width: "100%", opacity: 0.15 }}></div>
                  </div>
                  <div className="r-ch">{r.ch}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {finalPopularNow.length > 0 && <div className="divider"></div>}
      <AdCashBanner />


      {/* TRENDING SECTION (12 ITEMS) */}
      {finalTrending.length > 0 && (
        <div className="section">
          <div className="s-hd">
            <div className="s-title">Trending This Week</div>
            <Link href="/browse?sort=trending" className="s-link" style={{ textDecoration: 'none' }}>
              See all →
            </Link>
          </div>
          <div className="manga-grid">
            {finalTrending.map((m, idx) => (
              <MangaCard key={m.id} manga={m} index={idx} />
            ))}
          </div>
        </div>
      )}

      {finalTrending.length > 0 && <div className="divider"></div>}

      <HomeGenreFilter />

      <div className="divider"></div>

      {/* READERS ALSO LOVE (12 ITEMS) */}
      {finalPopularOverall.length > 0 && (
        <div className="section">
          <div className="s-hd">
            <div className="s-title">Readers Also Love</div>
            <Link href="/browse" className="s-link" style={{ textDecoration: 'none' }}>
              See all →
            </Link>
          </div>
          <div className="manga-grid">
            {finalPopularOverall.map((m, idx) => (
              <MangaCard key={m.id} manga={m} index={idx} />
            ))}
          </div>
          <HomeAuthNudge />
        </div>
      )}

      {finalPopularOverall.length > 0 && <div className="divider"></div>}

      {/* RECENTLY ADDED (10 ITEMS) */}
      {finalRecentlyAdded.length > 0 && (
        <div className="section">
          <div className="s-hd">
            <div className="s-title">Recently Added</div>
          </div>
          <div className="recent-list">
            {finalRecentlyAdded.map((r, idx) => (
              <Link href={`/manga/${slugify(r.t || r.title)}${r.cover ? `?cover=${encodeURIComponent(r.cover)}` : ''}`} key={r.id} className="rc-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  className="rc-cov"
                  style={
                    r.cover
                      ? { position: "relative", overflow: "hidden" }
                      : {}
                  }
                >
                  {r.cover ? (
                    <Image
                      src={proxyImage(r.cover)}
                      alt={`Cover for ${r.t}`}
                      fill
                      sizes="48px"
                      style={{ objectFit: "cover", objectPosition: "center" }}
                      
                    />
                  ) : (
                    abbr(r.t)
                  )}
                </div>
                <div className="rc-body">
                  <div className="rc-title">{r.t}</div>
                  <div className="rc-sub">{r.ch} · {r.g}</div>
                </div>
                {r.latest_source ? (
                  <div className="rc-new">NEW</div>
                ) : (
                  r.hot && <div className="rc-new">HOT</div>
                )}
                <div className="rc-time">Recently</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="divider"></div>

      {/* ALL GENRES TILES */}
      <div className="section">
        <div className="s-hd">
          <div className="s-title">All Genres</div>
        </div>
        <div className="genre-tiles">
          {ALL_GENRES.map((g, idx) => (
            <Link href={`/browse?genre=${g}`} key={idx} className="genre-tile" style={{ textDecoration: 'none' }}>
              {g}
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
