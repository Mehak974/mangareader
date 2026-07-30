"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Sticky sidebar that auto-generates a Table of Contents from the article's
 * h2/h3 headings. Highlights the currently visible section on scroll.
 */
export default function BlogSidebar({ body, relatedBlogs = [] }) {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState("");

  // Extract headings from markdown body
  useEffect(() => {
    const lines = (body || "").split("\n");
    const extracted = [];
    for (const line of lines) {
      const m2 = line.match(/^## (.+)/);
      const m3 = line.match(/^### (.+)/);
      if (m2) {
        // Strip emojis for the id, keep for display
        const text = m2[1].trim();
        const id = text
          .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        extracted.push({ level: 2, text, id });
      } else if (m3) {
        const text = m3[1].trim();
        const id = text
          .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        extracted.push({ level: 3, text, id });
      }
    }
    setHeadings(extracted);
  }, [body]);

  // Intersection observer to highlight active heading
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    // Small delay so the DOM headings are rendered
    const timer = setTimeout(() => {
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el) observer.observe(el);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [headings]);

  return (
    <aside className="blog-sidebar">
      <div className="blog-sidebar-inner" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Table of Contents */}
        {headings.length >= 2 && (
          <div>
            <div className="blog-sidebar-title">📑 In This Article</div>
            <nav className="blog-sidebar-nav">
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className={`blog-sidebar-link ${h.level === 3 ? "blog-sidebar-link--sub" : ""} ${
                    activeId === h.id ? "blog-sidebar-link--active" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(h.id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "start" });
                      setActiveId(h.id);
                    }
                  }}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* Support Us */}
        <div>
          <div className="blog-sidebar-title">💖 Support Us</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '12px' }}>
            We rely on readers like you to keep MangaReader ad-free and lightning fast. 
          </div>
          <a 
            href="https://www.paypal.com/paypalme/manireader" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-m"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Buy us a coffee ☕
          </a>
        </div>

        {/* Related Blogs */}
        {relatedBlogs.length > 0 && (
          <div>
            <div className="blog-sidebar-title">📚 Keep Reading</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {relatedBlogs.map((b) => (
                <a
                  key={b.id}
                  href={`/blog/${b.slug}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
                >
                  {b.coverImage && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <Image
                        src={b.coverImage}
                        alt={b.title}
                        fill
                        sizes="200px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  {!b.coverImage && (
                    <div style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 'var(--r)',
                      background: 'linear-gradient(135deg, var(--accent-bg), var(--bg3))',
                    }} />
                  )}
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                    {b.title}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
