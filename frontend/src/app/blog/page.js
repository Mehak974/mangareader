import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import AdCashBanner from "@/components/AdCashBanner";

import { listPublishedArticles } from "@/lib/editorial";
import { buildMetadata, websiteSchema, breadcrumbSchema, SITE_URL } from "@/lib/seo";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function proxyImage(url) {
  if (!url || url.startsWith("/")) return url;
  return `${apiBase}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

export const metadata = buildMetadata({
  title: "The Reading Room — Manga Reviews, Guides & Editorials",
  description:
    "In-depth manga reviews, beginner reading guides, curated recommendations, and editorials from the MangaReader team.",
  path: "/blog",
});

// Cache the blog list and revalidate it in the background every 60 seconds
export const revalidate = 60;

const TYPE_LABEL = {
  BLOG: "Blog",
  REVIEW: "Review",
  GUIDE: "Guide",
  RECOMMENDATION: "Recommendations",
  EDITORIAL: "Editorial",
  NEWS: "News",
};

const BLOG_TABS = [
  { label: "All blogs", id: "all" },
  { label: "Guides", id: "guides", slugs: ["beginners-guides", "genre-guide", "story-type-guide", "publishing-industry-guide", "creator-guide"] },
  { label: "Reading Order", id: "reading-order", slugs: ["reading-guides"] },
  { label: "Top Series", id: "top-series", slugs: ["ranking"] },
  { label: "Genre Based", id: "genre-based", slugs: ["genre-guide"] },
  { label: "If You Like...", id: "if-you-like", slugs: ["if-you-like", "if-you-like-manga", "if-you-like-manhwa", "if-you-like-manhua", "if-you-like-web-comics"] },
  { label: "News", id: "news", slugs: ["bonus-blogs"] },
];

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function Blog({ searchParams }) {
  const sp = await searchParams;
  const tabId = sp?.tab || "all";
  
  const activeTab = BLOG_TABS.find(t => t.id === tabId) || BLOG_TABS[0];
  
  const queryOpts = { take: 24 };
  if (activeTab.slugs) {
    queryOpts.categorySlugs = activeTab.slugs;
  }

  const { items } = await listPublishedArticles(queryOpts);

  const featured = items[0] || null;
  const sideCards = items.slice(1, 3);
  const listItems = items.slice(3);

  return (
    <div>
      <JsonLd data={websiteSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
        ])}
      />

      {/* BLOG HERO */}
      <div className="blog-hero">
        <h1>The Reading Room</h1>
        <p>Essays, reviews, and deep dives from the MangaReader editorial team.</p>
      </div>

      <div className="blog-tabs" style={{ display: "flex", gap: "12px", padding: "0 20px", overflowX: "auto", marginBottom: "30px", maxWidth: "1200px", margin: "0 auto 30px" }}>
        {BLOG_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/blog${tab.id === "all" ? "" : `?tab=${tab.id}`}`}
            className={`badge ${tabId === tab.id ? "badge-ongoing" : "badge-done"}`}
            style={{ padding: "8px 16px", fontSize: "14px", whiteSpace: "nowrap", textDecoration: "none", cursor: "pointer" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <AdCashBanner />



      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text3)" }}>
          <p style={{ fontSize: "15px" }}>No articles published in this category yet.</p>
          <p style={{ fontSize: "13px" }}>Check back soon — the editorial team is hard at work.</p>
        </div>
      ) : (
        <>
          {/* FEATURED + SIDE CARDS */}
          <div className="blog-featured">
            <Link href={`/blog/${featured.slug}`} className="blog-card">
              <div
                className="blog-thumb"
                style={{
                  height: "220px",
                  position: "relative",
                  overflow: "hidden",
                  background: featured.coverImage ? "none" : "linear-gradient(160deg, var(--accent-bg), var(--bg3))",
                }}
              >
                {featured.coverImage && (
                  <Image
                    src={proxyImage(featured.coverImage)}
                    alt={`Cover for ${featured.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    style={{ objectFit: "cover", objectPosition: "center" }}
                    priority
                  />
                )}
                <div className="blog-thumb-tag" style={{ position: "relative", zIndex: 1 }}>FEATURED</div>
                {!featured.coverImage && <span>表紙</span>}
              </div>
              <div className="blog-body">
                <div className="blog-cat-label">
                  {featured.category?.name || TYPE_LABEL[featured.contentType]}
                </div>
                <div className="blog-card-title">{featured.title}</div>
                {featured.excerpt && <div className="blog-excerpt">{featured.excerpt}</div>}
                <div className="blog-meta">
                  {featured.byline?.name || "Editorial Team"}
                  <div className="blog-meta-dot"></div>
                  {fmtDate(featured.publishedAt)}
                  <div className="blog-meta-dot"></div>
                  {featured.readingMinutes} min
                </div>
              </div>
            </Link>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {sideCards.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="blog-card">
                  <div
                    className="blog-thumb"
                    style={{
                      height: "120px",
                      position: "relative",
                      overflow: "hidden",
                      background: post.coverImage ? "none" : "linear-gradient(135deg, rgba(168,85,247,.15), var(--bg3))",
                    }}
                  >
                    {post.coverImage && (
                      <Image
                        src={proxyImage(post.coverImage)}
                        alt={`Cover for ${post.title}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 400px"
                        style={{ objectFit: "cover", objectPosition: "center" }}
                      />
                    )}
                    {!post.coverImage && <span>表</span>}
                  </div>
                  <div className="blog-body">
                    <div className="blog-cat-label">
                      {post.category?.name || TYPE_LABEL[post.contentType]}
                    </div>
                    <div className="blog-card-title">{post.title}</div>
                    <div className="blog-meta">
                      {post.byline?.name || "Editorial Team"}
                      <div className="blog-meta-dot"></div>
                      {fmtDate(post.publishedAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* LIST ITEMS */}
          <div id="blog-list">
            {listItems.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="blog-list-item">
                <div
                  className="blog-list-thumb"
                  style={p.coverImage ? {
                    position: "relative",
                    overflow: "hidden",
                    color: 'transparent',
                  } : {}}
                >
                  {p.coverImage && (
                    <Image
                      src={p.coverImage}
                      alt={`Cover for ${p.title}`}
                      fill
                      sizes="150px"
                      style={{ objectFit: "cover", objectPosition: "center" }}
                    />
                  )}
                  {!p.coverImage && (p.category?.name || TYPE_LABEL[p.contentType] || "A")[0]}
                </div>
                <div className="blog-list-body">
                  <div className="blog-list-cat">
                    {p.category?.name || TYPE_LABEL[p.contentType]}
                  </div>
                  <div className="blog-list-title">{p.title}</div>
                  <div className="blog-list-meta">
                    {p.byline?.name || "Editorial Team"} · {fmtDate(p.publishedAt)} ·{" "}
                    {p.readingMinutes} min
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}
