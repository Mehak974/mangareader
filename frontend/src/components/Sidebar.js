"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    sidebarOpen,
    setSidebarOpen,
    isLoggedIn,
    isIncognito,
    toggleIncognito,
    doSignout,
    setSigninSheetOpen,
  } = useApp();

  // Hide sidebar in reader mode
  if (pathname?.startsWith("/reader")) {
    return null;
  }

  const handleLinkClick = () => {
    setSidebarOpen(false);
  };

  const handleSignOutClick = () => {
    doSignout();
    setSidebarOpen(false);
    router.push("/");
  };

  return (
    <>
      {/* SIDEBAR BACKDROP */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* SIDEBAR DRAWER */}
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
        <div className="sb-head">
          <div className="sb-logo">
            manga <span>reader</span>
          </div>
          <button className="sb-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* User Info Section */}
        {isLoggedIn ? (
          <div className="sb-user auth-only">
            <div className="sb-avatar">長</div>
            <div>
              <div className="sb-user-name">Tsukasa</div>
              <div className="sb-user-sub">@tsukasa · Free plan</div>
            </div>
          </div>
        ) : (
          <div
            className="sb-user guest-only"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setSidebarOpen(false);
              setSigninSheetOpen(true);
            }}
          >
            <div className="sb-avatar" style={{ background: "var(--surface2)" }}>
              ?
            </div>
            <div>
              <div className="sb-user-name">Guest</div>
              <div className="sb-user-sub" style={{ color: "var(--accent)" }}>
                Sign in to sync →
              </div>
            </div>
          </div>
        )}

        {/* Incognito row */}
        <div className="sb-incognito-row">
          <div className="sb-incognito-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Incognito
          </div>
          <div
            className={`tog ${isIncognito ? "on" : ""}`}
            role="switch"
            aria-checked={isIncognito}
            tabIndex={0}
            aria-label="Toggle incognito mode"
            onClick={toggleIncognito}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleIncognito();
              }
            }}
          />
        </div>

        <div className="sb-section-label">Discover</div>
        <Link
          href="/"
          className={`sb-item ${pathname === "/" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12L12 3l9 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Home
        </Link>
        <Link
          href="/browse"
          className={`sb-item ${pathname === "/browse" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Browse
        </Link>
        <Link
          href="/browse?sort=trending"
          className={`sb-item ${pathname === "/browse" && router.asPath?.includes("trending") ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <polyline
              points="23 6 13.5 15.5 8.5 10.5 1 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="17 6 23 6 23 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Trending<span className="sb-badge">🔥</span>
        </Link>
        <Link
          href="/browse?sort=latest"
          className="sb-item"
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 7v5l3 3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Latest
        </Link>
        <Link
          href="/browse?sort=completed"
          className="sb-item"
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Completed Series
        </Link>
        <Link
          href="/blog"
          className={`sb-item ${pathname?.startsWith("/blog") ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Blog
        </Link>

        <div className="sb-section-label">My Stuff</div>
        <Link
          href="/library"
          className={`sb-item ${pathname === "/library" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 3h12v18l-6-4-6 4V3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Library
        </Link>
        <Link
          href="/library?tab=completed"
          className="sb-item"
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 11l3 3L22 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Completed Reading
        </Link>
        <Link
          href="/library?tab=collections"
          className="sb-item"
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="3" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="12" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="3" y="16" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Collections
        </Link>
        <Link
          href="/history"
          className={`sb-item ${pathname === "/history" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          History
        </Link>
        <Link
          href="/profile"
          className={`sb-item ${pathname === "/profile" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Profile
        </Link>
        <Link
          href="/settings"
          className={`sb-item ${pathname === "/settings" ? "active" : ""}`}
          onClick={handleLinkClick}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          Settings
        </Link>

        <div className="sb-divider"></div>
        <div className="sb-section-label">Info</div>
        <Link href="/about" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 8h.01M11 12h1v4h1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          About Us
        </Link>
        <Link href="/contact" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Contact Us
        </Link>
        <Link href="/support" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Support Us
        </Link>
        <Link href="/faq" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          FAQ
        </Link>

        <div className="sb-divider"></div>
        <div className="sb-section-label">Legal</div>
        <Link href="/privacy" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Privacy Policy
        </Link>
        <Link href="/terms" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Terms of Service
        </Link>
        <Link href="/dmca" className="sb-item" onClick={handleLinkClick}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          DMCA
        </Link>

        <div className="sb-footer">
          <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "8px" }}>
            © 2026 MangaReader. All rights reserved.
          </div>
          {isLoggedIn && (
            <button
              className="sb-item red"
              style={{ padding: "8px 0", borderLeft: "none" }}
              onClick={handleSignOutClick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Sign Out
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
