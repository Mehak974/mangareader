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
          <Link href="/about?tab=support">Support Us</Link>
        </div>
        <div>
          <h2>Stay Updated</h2>
          <NewsletterForm />
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 MangaReader.</span>
        <span className="footer-bottom-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/about?tab=contact">Contact</Link>
          <Link href="/dmca">DMCA</Link>
        </span>
      </div>
    </footer>
  );
}
