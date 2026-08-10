import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ALL_GENRES, abbr } from "@/data/mockData";
import { slugify } from "@/utils/slugify";
import { getMangaList, getRecentMangaList, isExplicitNSFW } from "@/utils/anilist";
import { proxyImage } from "@/utils/api";
import MangaCard from "@/components/MangaCard";
import HomeGenreFilter from "@/components/HomeGenreFilter";
import HomeAuthNudge from "@/components/HomeAuthNudge";

const Footer = dynamic(() => import("@/components/Footer"));

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const revalidate = 43200; // Revalidate every 12 hours (ISR) — balances freshness vs cold-start LCP

// Server components can be async
export default async function Home() {
  // ── Critical path: fetch AniList data first (determines the hero image / LCP) ──
  // These are fetched in parallel. The backend /api/home fetch is deliberately
  // NOT in this Promise.all so a slow backend can't delay the hero image.
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const [popularNowRes, trendingRes] = await Promise.race([
    Promise.all([
      getMangaList({ perPage: 12, genre: "Fantasy", countryOfOrigin: "KR", sort: ["POPULARITY_DESC"] }),
      delay(800).then(() => getMangaList({ perPage: 16, sort: ["TRENDING_DESC"] })),
    ]),
    new Promise(resolve => setTimeout(() => resolve([null, null]), 3000)),
  ]);

  let popularNow = popularNowRes?.media?.length > 0
    ? popularNowRes.media
    : [];

  let trending = trendingRes?.media?.length > 0
    ? trendingRes.media
    : [];

  const popularOverallRes = await Promise.race([
    delay(1600).then(() => getMangaList({ perPage: 16, sort: ["POPULARITY_DESC"] })),
    new Promise(resolve => setTimeout(() => resolve(null), 3000)),
  ]);

  let popularOverall = popularOverallRes?.media?.length > 0
    ? popularOverallRes.media
    : [];

  // ── Non-critical: AniList fetch for Recently Added ──
  const recentRes = await getRecentMangaList({ perPage: 5, genres: ["Adventure", "Fantasy"], countryOfOrigin: "KR", sort: ["ID_DESC"] }).catch(() => ({ media: [] }));

  let recentlyAdded = [];
  if (recentRes?.media?.length > 0) {
    recentlyAdded = recentRes.media.map(m => ({
      id: m.id,
      t: m.t,
      cover: m.cover,
      ch: m.ch,
      g: m.g || "Ongoing",
      hot: true
    }));
  }
  let finalPopularNow = popularNow.slice(0, 9);
  let finalTrending = trending.slice(0, 12);
  let finalPopularOverall = popularOverall.slice(0, 12);
  const finalRecentlyAdded = recentlyAdded.slice(0, 5);

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
    <>
      {featuredHero?.cover && (
        <link rel="preload" as="image" href={featuredHero.cover} media="(max-width: 768px)" />
      )}
      {desktopHero?.cover && (
        <link rel="preload" as="image" href={proxyImage(desktopHero.cover, 800)} media="(min-width: 769px)" />
      )}
      <div>
      {/* MOBILE HERO VIEWPORT */}
      <div className="mob-hero">
        {featuredHero ? (
          <Link href={`/manga/${slugify(featuredHero.t || featuredHero.title)}${featuredHero.cover ? `?cover=${encodeURIComponent(featuredHero.cover)}` : ''}`} className="mob-resume" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              className="mob-cov"
              style={
                featuredHero.cover
                  ? { position: "relative", overflow: "hidden" }
                  : {}
              }
            >
                {featuredHero.cover ? (
                  <img
                     src={featuredHero.cover}
                     alt={`Cover for ${featuredHero.t}`}
                     style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                     loading="eager"
                     fetchPriority="high"
                     referrerPolicy="no-referrer"
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
          <Link href={`/manga/${slugify(desktopHero.t || desktopHero.title)}${desktopHero.cover ? `?cover=${encodeURIComponent(desktopHero.cover)}` : ''}`} className="hero-stack" style={{ textDecoration: 'none', color: 'inherit' }}>
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
                   <img
                      src={desktopHero.cover}
                      alt={`Cover for ${desktopHero.t}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                      loading="eager"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
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
              <Link href={`/manga/${slugify(r.t || r.title)}${r.cover ? `?cover=${encodeURIComponent(r.cover)}` : ''}`} key={r.id} className="r-item" style={{ textDecoration: 'none', color: 'inherit' }}>
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
                       src={proxyImage(r.cover, 150)}
                       alt={`Cover for ${r.t}`}
                       fill
                        sizes="(max-width: 768px) 32px, 38px"
                        style={{ objectFit: "cover", objectPosition: "center" }}
                        loading="lazy"
                        decoding="async"
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

      {/* DONATE SECTION */}
      <div className="nudge" style={{ margin: "40px 20px" }}>
        <div>
          <h2>Love MangaReader? Buy us a coffee! ☕</h2>
          <p>Your support helps us keep the servers running and manga updates flowing.</p>
        </div>
        <Link href="https://www.paypal.com/paypalme/manireader" target="_blank" rel="noopener noreferrer" className="nudge-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          Donate via PayPal
        </Link>
      </div>

      <div className="divider"></div>

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
                       src={proxyImage(r.cover, 100)}
                       alt={`Cover for ${r.t}`}
                       fill
                        sizes="32px"
                        style={{ objectFit: "cover", objectPosition: "center" }}
                        loading="lazy"
                        decoding="async"
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
    </>
  );
}
