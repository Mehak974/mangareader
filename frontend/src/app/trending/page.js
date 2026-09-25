/**
 * /trending — high-intent landing page for "best manga 2024"-style queries.
 *
 * Server-rendered with ISR (revalidate: 3600) so it's always fresh but never
 * expensive: the first visitor after revalidation pays the AniList cost,
 * everyone else gets a static HTML response from Vercel's edge.
 */
import Link from "next/link";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import MangaCard from "@/components/MangaCard";
import { getMangaList, isExplicitNSFW } from "@/utils/anilist";
import { buildMetadata, websiteSchema, breadcrumbSchema, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Trending Manga — What's Hot Right Now",
  description:
    "Discover the hottest manga trending right now. Track rising series, new releases, and community favorites updated hourly.",
  path: "/trending",
});

export default async function TrendingPage() {
  let trending: any[] = [];
  let popular: any[] = [];

  try {
    const [trendingRes, popularRes] = await Promise.all([
      getMangaList({ perPage: 30, sort: ["TRENDING_DESC", "POPULARITY_DESC"] }),
      getMangaList({ perPage: 30, sort: ["POPULARITY_DESC", "SCORE_DESC"] }),
    ]);
    trending = trendingRes?.media?.filter((m: any) => !isExplicitNSFW(m.genres, m.title?.userPreferred || m.title?.english || "", { isAdult: m.isAdult })) || [];
    popular = popularRes?.media?.filter((m: any) => !isExplicitNSFW(m.genres, m.title?.userPreferred || m.title?.english || "", { isAdult: m.isAdult })) || [];
  } catch {
    // leave empty — same behavior as /browse when AniList is unreachable
  }

  if (trending.length === 0 && popular.length === 0) {
    return (
      <div className="static-page" style={{ padding: "80px 20px", textAlign: "center" }}>
        <h1>Trending Manga</h1>
        <p style={{ color: "var(--text3)" }}>Could not load trending titles. Please try again shortly.</p>
        <Link href="/browse" className="btn btn-p" style={{ marginTop: "16px", display: "inline-block" }}>
          ← Back to Browse
        </Link>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <JsonLd data={websiteSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Trending", url: `${SITE_URL}/trending` },
        ])}
      />

      {/* HERO */}
      <section className="hero" style={{ paddingTop: "40px" }}>
        <div>
          <div className="eyebrow">🔥 What's Hot</div>
          <h1>Trending Manga</h1>
          <p className="hero-sub">
            The series everyone is reading right now. Updated every hour from community
            activity — find your next obsession before the rest of the web does.
          </p>
          <div className="hero-btns">
            <Link href="#trending-list" className="btn btn-p" style={{ textDecoration: "none" }}>
              Explore Trending
            </Link>
            <Link href="/browse?sort=popular" className="btn btn-s" style={{ textDecoration: "none" }}>
              Most Popular →
            </Link>
          </div>
        </div>
      </section>

      {/* TRENDING GRID */}
      <div className="section" id="trending-list">
        <div className="s-hd">
          <div className="s-title">Trending This Week</div>
          <span style={{ fontSize: "12px", color: "var(--text3)" }}>
            {trending.length} titles · sorted by community velocity
          </span>
        </div>
        <div className="manga-grid">
          {trending.map((m: any, idx: number) => (
            <MangaCard key={m.id} manga={m} index={idx} priority={idx < 4} />
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* POPULAR ALL-TIME */}
      <div className="section">
        <div className="s-hd">
          <div className="s-title">Most Popular — All Time</div>
          <span style={{ fontSize: "12px", color: "var(--text3)" }}>
            {popular.length} titles · ranked by lifetime readership
          </span>
        </div>
        <div className="manga-grid">
          {popular.map((m: any, idx: number) => (
            <MangaCard key={m.id} manga={m} index={idx} priority={idx < 4} />
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* CTA to browse */}
      <div className="nudge" style={{ margin: "40px 20px", textAlign: "center" }}>
        <h2>Can't find what you're looking for?</h2>
        <p style={{ color: "var(--text3)", marginBottom: "16px" }}>
          Browse by genre, filter by status, or search our full catalogue.
        </p>
        <Link href="/browse" className="btn btn-p" style={{ textDecoration: "none", display: "inline-block" }}>
          Browse All Manga
        </Link>
      </div>

      <Footer />
    </div>
  );
}