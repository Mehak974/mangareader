"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";

function LibraryContent() {
  const searchParams = useSearchParams();
  const { isLoggedIn, bookmarks, libraries, readChapters, setSigninSheetOpen } = useApp();
  const [activeTab, setActiveTab] = useState("collections");

  // Read initial tab parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (tabParam === "completed") setActiveTab("completed");
      else if (tabParam === "collections") setActiveTab("collections");
    }
  }, [searchParams]);

  // Collections are now real libraries mapped from Context.

  return (
    <div>
      {isLoggedIn ? (
        <div className="auth-only">
          <h1 style={{fontSize: '24px', marginBottom: '16px'}}>Library</h1>
          <div className="lib-tabs">
            <button
              className={`lib-tab active`}
            >
              Collections
            </button>
          </div>

          <div className="section">

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                  <div className="s-title">My Collections</div>
                </div>
                <div className="coll-grid">
                  {libraries.map((c) => (
                    <div key={c.id} className="coll-card">
                      <div className="coll-covers">
                        {c.manga?.slice(0, 4).map((m, i) => (
                          <div key={i} className="coll-cov">
                            {m.cover ? (
                              <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "4px", overflow: "hidden" }}>
                                <Image
                                  src={m.cover}
                                  alt={`Cover for ${m.title}`}
                                  fill
                                  sizes="120px"
                                  style={{ objectFit: "cover", objectPosition: "center" }}
                                />
                              </div>
                            ) : (
                              m.title?.substring(0, 2).toUpperCase()
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="coll-info">
                        <div className="coll-name">{c.name === "default" ? "Default Library" : c.name}</div>
                        <div className="coll-count">{c.manga?.length || 0} titles</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        </div>
      ) : (
        /* GUEST AUTH GATE */
        <div className="guest-only">
          <div className="auth-gate">
            <div className="auth-gate-icon">📚</div>
            <h1 style={{fontSize: '18px'}}>Your Library Lives Here</h1>
            <p>Track your reading progress, bookmark favourites, and organise manga into collections.</p>
            <div className="auth-gate-perks">
              <div className="auth-gate-perk">Track progress across 3,400+ titles</div>
              <div className="auth-gate-perk">Bookmark chapters and sync across devices</div>
              <div className="auth-gate-perk">Create custom collections and lists</div>
              <div className="auth-gate-perk">Never lose your place again</div>
            </div>
            <button className="btn btn-p btn-pill" onClick={() => setSigninSheetOpen(true)}>
              Sign in free
            </button>
            <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "4px" }}>
              No credit card required · Free forever
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function Library() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>}>
      <LibraryContent />
    </Suspense>
  );
}
