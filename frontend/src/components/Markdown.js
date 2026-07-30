"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

/**
 * Rich editorial markdown renderer with custom components for a visually
 * engaging blog reading experience. Uses GFM for tables/strikethrough.
 * rehype-sanitize removed because content is staff-authored and the custom
 * component overrides need raw element access.
 */

/* ── heading icons by depth ────────────────────────────────── */
const H_ICONS = { 2: "📌", 3: "▸" };

function Heading({ node, children, ...props }) {
  const level = Number(node.tagName?.[1] || props.level || 2);
  const Tag = `h${level}`;
  const icon = H_ICONS[level] || "";
  // Build a slug id from text content for sidebar anchor links
  const text = typeof children === "string"
    ? children
    : Array.isArray(children)
      ? children.map((c) => (typeof c === "string" ? c : c?.props?.children ? String(c.props.children) : "")).join("")
      : String(children || "");
  const id = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (
    <Tag className={`prose-h${level}`} id={id} style={{ scrollMarginTop: "80px" }}>
      {icon && <span className="prose-h-icon">{icon} </span>}
      {children}
    </Tag>
  );
}


/* ── blockquote with auto-detected callout type ───────────── */
function Blockquote({ children }) {
  // Detect ⚡ Quick Answer callouts
  const text =
    typeof children === "string"
      ? children
      : children
          ?.map((c) =>
            typeof c === "string"
              ? c
              : c?.props?.children
                ? String(c.props.children)
                : ""
          )
          .join("") || "";

  const isQuick = text.includes("⚡") || text.includes("Quick Answer");
  return (
    <blockquote className={`prose-bq ${isQuick ? "prose-bq--quick" : ""}`}>
      {isQuick && <div className="prose-bq-badge">⚡ Quick Answer</div>}
      {children}
    </blockquote>
  );
}

/* ── styled table wrapper ─────────────────────────────────── */
function Table({ children }) {
  return (
    <div className="prose-table-wrap">
      <table className="prose-table">{children}</table>
    </div>
  );
}

/* ── list items with accent bullets ───────────────────────── */
function Li({ children, ordered, index }) {
  return <li className="prose-li">{children}</li>;
}

/* ── bold text with accent color ──────────────────────────── */
function Strong({ children }) {
  return <strong className="prose-strong">{children}</strong>;
}

/* ── emphasis / italic with subtle style ──────────────────── */
function Em({ children }) {
  return <em className="prose-em">{children}</em>;
}

/* ── links ────────────────────────────────────────────────── */
function A({ href, children }) {
  return (
    <a href={href} className="prose-link" target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}

/* ── horizontal rule as a decorative divider ──────────────── */
function Hr() {
  return <div className="prose-divider"><span>✦</span></div>;
}

/* ── image with uniform sizing and aspect ratio ───────────── */
function Img({ src, alt }) {
  return (
    <span className="prose-img-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '220px', aspectRatio: '300 / 500', borderRadius: 'var(--rl)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <Image
          src={src}
          alt={alt || "Article image"}
          fill
          sizes="220px"
          style={{ objectFit: 'cover' }}
        />
      </div>
      {alt && (
        <span style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '10px', fontStyle: 'italic', textAlign: 'center' }}>
          {alt}
        </span>
      )}
    </span>
  );
}

const components = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  blockquote: Blockquote,
  table: Table,
  li: Li,
  strong: Strong,
  em: Em,
  a: A,
  hr: Hr,
  img: Img,
};

export default function Markdown({ children }) {
  return (
    <div className="article-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
