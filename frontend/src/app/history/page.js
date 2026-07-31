"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { abbr } from "@/data/mockData";
import Footer from "@/components/Footer";
import { slugify } from "@/utils/slugify";

export default function History() {
  const router = useRouter();
  const { isLoggedIn, readingHistory, clearHistory, isIncognito, setSigninSheetOpen } = useApp();

  const formatTime = (d) => {
    if (!d) return "";
    const dateObj = new Date(d);
    const mins = Math.floor((Date.now() - dateObj) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return dateObj.toLocaleDateString();
  };

  return (
    <div>
      {isLoggedIn ? (
        <div className="auth-only">
          <div className="section" style={{ paddingBottom: "8px" }}>
            <div className="s-hd">
              <h1 className="s-title">Reading History</h1>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                  {isIncognito ? "Incognito is ON — history paused" : ""}
                </span>
                <button
                  className="btn btn-s"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={clearHistory}
                  disabled={!readingHistory.length}
                >
                  Clear All
                </button>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text3)", marginTop: "-8px" }}>
              One entry per manga — showing the latest chapter you read.
            </p>
          </div>

          <div style={{ minHeight: "260px" }}>
            {readingHistory.length ? (
              readingHistory.map((h, idx) => (
                <div
                  key={idx}
                  className="history-row"
                  onClick={() => {
                    if (h.url && h.mangaId) {
                      router.push(`/reader/${h.chNum || 1}?url=${encodeURIComponent(h.url)}&source=${h.source || ""}&title=${encodeURIComponent(h.t)}&mangaId=${encodeURIComponent(h.mangaId)}`);
                    } else {
                      router.push(`/manga/${slugify(h.t)}`);
                    }
                  }}
                >
                  <div 
                    className="hist-cov"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/manga/${slugify(h.t)}`);
                    }}
                    style={{ overflow: "hidden", padding: 0 }}
                  >
                    {h.cover ? (
                      <img src={h.cover} alt={h.t} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                        {abbr(h.t)}
                      </div>
                    )}
                  </div>
                  <div className="hist-body">
                    <div className="hist-title">{h.t}</div>
                    <div className="hist-ch">{h.ch}</div>
                  </div>
                  <div className="hist-badge">Last read: {formatTime(h.time)}</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text3)" }}>
                No reading history yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GUEST AUTH GATE */
        <div className="guest-only">
          <div className="auth-gate">
            <div className="auth-gate-icon">🕐</div>
            <h1 style={{fontSize: '18px'}}>Your Reading History</h1>
            <p>Every manga you read, saved automatically. Jump back to any series right where you left off.</p>
            <div className="auth-gate-perks">
              <div className="auth-gate-perk">Auto-saved as you read</div>
              <div className="auth-gate-perk">Latest chapter per manga — no clutter</div>
              <div className="auth-gate-perk">Incognito mode to read privately</div>
              <div className="auth-gate-perk">Synced across all your devices</div>
            </div>
            <button className="btn btn-p btn-pill" onClick={() => setSigninSheetOpen(true)}>
              Sign in free
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
