"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";

export default function MobileNav() {
  const pathname = usePathname();
  const { isLoggedIn, setSigninSheetOpen } = useApp();

  // Hide mobile nav in reader mode
  if (pathname?.startsWith("/reader")) {
    return null;
  }

  const handleMeTabClick = (e) => {
    if (!isLoggedIn) {
      e.preventDefault();
      setSigninSheetOpen(true);
    }
  };

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        <Link href="/" className={`mob-tab ${pathname === "/" ? "active" : ""}`}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <path d="M3 12L12 3l9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path
              d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mob-tab-label">Home</span>
          <div className="mob-tab-dot" />
        </Link>

        <Link
          href="/browse"
          className={`mob-tab ${pathname === "/browse" ? "active" : ""}`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className="mob-tab-label">Browse</span>
          <div className="mob-tab-dot" />
        </Link>

        <Link
          href="/library"
          className={`mob-tab ${pathname === "/library" ? "active" : ""}`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 3h12v18l-6-4-6 4V3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mob-tab-label">Library</span>
          <div className="mob-tab-dot" />
        </Link>

        <Link
          href="/history"
          className={`mob-tab ${pathname?.startsWith("/history") ? "active" : ""}`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="mob-tab-label">History</span>
          <div className="mob-tab-dot" />
        </Link>

        <Link
          href="/profile"
          className={`mob-tab ${
            pathname === "/profile" ||
            pathname === "/settings"
              ? "active"
              : ""
          }`}
          onClick={handleMeTabClick}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="mob-tab-label">Me</span>
          <div className="mob-tab-dot" />
        </Link>
      </div>
    </nav>
  );
}
