import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Markdown from "@/components/Markdown";
import dynamicImport from "next/dynamic";

const DynamicMarkdown = dynamicImport(() => import("@/components/Markdown"), {
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-800 h-32 rounded-xl w-full"></div>
});

import BlogSidebarWrapper from "@/components/BlogSidebarWrapper";
import JsonLd from "@/components/JsonLd";
import ViewTracker from "@/components/ViewTracker";

import CommentSection from "@/components/CommentSection";
import { getPublishedArticle, listPublishedArticles } from "@/lib/editorial";
import {
  buildMetadata,
  articleSchema,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo";

import { proxyImage } from "@/utils/api";

// Cache articles for 60 seconds (ISR) so they load instantly from the CDN,
// while still updating in the background when edited.
export const revalidate = 60;

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function generateMetadata({ params }) {
  const { post } = await params;
  const article = await getPublishedArticle(post);
  if (!article) {
    return buildMetadata({ title: "Article not found", path: `/blog/${post}`, noIndex: true });
  }
  return buildMetadata({
    title: article.seoTitle || article.title,
    description:
      article.seoDescription || article.excerpt || `${article.title} — MangaReader editorial.`,
    path: `/blog/${article.slug}`,
    type: "article",
    image: article.ogImage || article.coverImage || undefined,
  });
}

const SCORE_ROWS = [
  ["Story", "storyScore"],
  ["Characters", "charactersScore"],
  ["Artwork", "artworkScore"],
  ["World-building", "worldScore"],
  ["Pacing", "pacingScore"],
];

export default async function BlogPost({ params }) {
  const { post } = await params;
  const article = await getPublishedArticle(post);
  if (!article) notFound();

  // Fetch related blogs (latest 3, excluding current)
  const { items: allRecent } = await listPublishedArticles({ take: 4 });
  const relatedBlogs = allRecent
    .filter(a => a.id !== article.id)
    .slice(0, 3)
    .map(a => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      coverImage: a.coverImage
    }));

  const authorName = article.byline?.name || "Editorial Team";
  const initials = authorName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const review = article.review;

  return (
    <div>
      <ViewTracker articleId={article.id} />
      <JsonLd
        data={articleSchema({
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          coverImage: article.coverImage,
          ogImage: article.ogImage,
          canonicalUrl: article.canonicalUrl,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          authorName,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: article.title, url: `${SITE_URL}/blog/${article.slug}` },
        ])}
      />

      <div className="blog-layout">
        <article className="blog-main">
          <Link
            href="/blog"
            className="btn btn-s"
            style={{ marginBottom: "20px", fontSize: "12px", padding: "7px 14px", display: "inline-block" }}
          >
            ← Blog
          </Link>

          <div
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: "var(--accent)",
              fontWeight: "700",
              marginBottom: "10px",
            }}
          >
            {article.category?.name || article.contentType} · {fmtDate(article.publishedAt)}
          </div>

          <h1 style={{ marginBottom: "12px", lineHeight: 1.15, fontSize: "32px" }}>{article.title}</h1>

          {article.excerpt && (
            <p style={{ fontSize: "17px", color: "var(--text2)", marginBottom: "20px", lineHeight: 1.6 }}>
              {article.excerpt}
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "26px",
              paddingBottom: "18px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "var(--accent-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                color: "var(--accent)",
                fontWeight: "700",
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600" }}>{authorName}</div>
              <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                {article.readingMinutes} min read · {article.viewCount.toLocaleString()} views
              </div>
            </div>
          </div>

           {/* Cover image */}
           <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', marginBottom: '28px', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              {article.coverImage ? (
                <Image
                  src={proxyImage(article.coverImage)}
                  alt={article.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  style={{
                    objectFit: "cover",
                    borderRadius: "var(--rl)",
                    display: "block",
                  }}
                  priority
                />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, var(--accent-bg), var(--bg3))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--serif)',
                fontSize: '24px',
                color: 'rgba(232, 222, 255, .3)',
              }}>
                表紙
              </div>
            )}
          </div>

          {/* Review scorecard (only for REVIEW articles with structured data) */}
          {review && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--rl)",
                padding: "20px",
                marginBottom: "26px",
              }}
            >
              {typeof review.overallScore === "number" && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 800, color: "var(--accent)" }}>
                    {review.overallScore}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text3)" }}>/ 100 overall</span>
                </div>
              )}
              <div style={{ display: "grid", gap: "8px" }}>
                {SCORE_ROWS.map(([label, key]) =>
                  typeof review[key] === "number" ? (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text2)", width: "110px" }}>{label}</span>
                      <div style={{ flex: 1, height: "6px", background: "var(--surface2)", borderRadius: "3px" }}>
                        <div
                          style={{
                            width: `${review[key]}%`,
                            height: "100%",
                            background: "var(--accent)",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text3)", width: "34px", textAlign: "right" }}>
                        {review[key]}
                      </span>
                    </div>
                  ) : null
                )}
              </div>

              {(review.strengths?.length > 0 || review.weaknesses?.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "18px" }}>
                  {review.strengths?.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--green)", marginBottom: "6px" }}>
                        Strengths
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--text2)" }}>
                        {review.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {review.weaknesses?.length > 0 && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--red)", marginBottom: "6px" }}>
                        Weaknesses
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--text2)" }}>
                        {review.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {review.verdict && (
                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--border)",
                    fontSize: "14px",
                    fontStyle: "italic",
                    color: "var(--text2)",
                  }}
                >
                  {review.verdict}
                </div>
              )}
            </div>
          )}

          {/* Article body (markdown) */}
          <div className="article-body">
            <DynamicMarkdown>{article.body}</DynamicMarkdown>
          </div>

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div
              style={{
                marginTop: "36px",
                paddingTop: "22px",
                borderTop: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--text3)",
              }}
            >
              Tags:{" "}
              {article.tags.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && " · "}
                  <span style={{ color: "var(--accent)" }}>{t.name}</span>
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Sidebar — Table of Contents, Related Blogs, Support Us */}
        <BlogSidebarWrapper body={article.body} relatedBlogs={relatedBlogs} />
      </div>

      <div className="static-page" style={{ paddingTop: 0 }}>
        <CommentSection articleId={article.id} />
      </div>

      <Footer />
    </div>
  );
}
