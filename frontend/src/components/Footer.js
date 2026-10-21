"use client";

import React from "react";
import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="logo" style={{ cursor: "default", margin: 0 }}>
            manga <span>reader</span>
          </div>
          <p className="footer-tag">
            A cleaner corner of the internet for people who actually read manga.
          </p>
        </div>
        <div>
          <h2>Explore</h2>
          <Link href="/browse">Browse</Link>
          <Link href="/browse?sort=trending">Trending</Link>
          <Link href="/browse?sort=latest">New Releases</Link>
          <Link href="/browse?sort=completed">Completed Series</Link>
        </div>
        <div>
          <h2>Account</h2>
          <Link href="/library">Library</Link>
          <Link href="/history">History</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/messages">Support Messages</Link>
          <Link href="/about?tab=support">Support Us</Link>
        </div>
        <div>
          <h2>Stay Updated</h2>
          <NewsletterForm />
        </div>
      </div>

      {/* Official Mirrors cross-linking for SEO authority transfer & backup discovery */}
      <div
        style={{
          margin: "20px 0 12px",
          padding: "10px 16px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "14px",
          fontSize: "12px",
          color: "var(--text3, #888)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text2, #bbb)" }}>🌐 Official Mirrors:</span>
        <a href="https://mangareader.pro" style={{ color: "#a855f7", textDecoration: "none", fontWeight: 500 }} title="MangaReader Primary Hub">
          MangaReader.pro
        </a>
        <span>•</span>
        <a href="https://mangaread.pro" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 500 }} title="Fast MangaRead Mirror">
          MangaRead.pro
        </a>
        <span>•</span>
        <a href="https://manireader.online" style={{ color: "#f97316", textDecoration: "none", fontWeight: 500 }} title="ManiReader Discovery Mirror">
          ManiReader.online
        </a>
      </div>

      <div className="footer-bottom">
        <span>© 2026 MangaReader.</span>
        <span className="footer-bottom-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/about?tab=contact">Contact</Link>
          <Link href="/messages">Messages</Link>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-feature-broadcast"));
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent2, #c084fc)",
              cursor: "pointer",
              font: "inherit",
              padding: 0,
              fontWeight: 500,
            }}
          >
            What&apos;s New ✨
          </button>
          <Link href="/dmca">DMCA</Link>
        </span>
      </div>
    </footer>
  );
}
