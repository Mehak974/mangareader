"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { MANGA, achievements } from "@/data/mockData";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";

export default function Profile() {
  const router = useRouter();
  const { isLoggedIn, setSigninSheetOpen } = useApp();

  return (
    <div>
      {isLoggedIn ? (
        <div className="auth-only">
          <div className="profile-header">
            <h1 className="sr-only">Profile</h1>
            <div className="profile-avatar">長</div>
            <div className="profile-name">Tsukasa</div>
            <div className="profile-handle">@tsukasa · Member since 2023</div>
            <div className="profile-stats">
              <div className="p-stat">
                <b>312</b>
                <span>Chapters</span>
              </div>
              <div className="p-stat">
                <b>28</b>
                <span>Series</span>
              </div>
              <div className="p-stat">
                <b>7</b>
                <span>Collections</span>
              </div>
              <div className="p-stat">
                <b>142h</b>
                <span>Read time</span>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="s-hd">
              <h2 className="s-title">Currently Reading</h2>
              <span className="s-link" onClick={() => router.push("/library")}>
                Library →
              </span>
            </div>
            <div className="manga-grid">
              {MANGA.slice(0, 4).map((m, idx) => (
                <MangaCard key={m.id} manga={m} index={idx} />
              ))}
            </div>
          </div>

          <div className="divider"></div>

          <div className="section">
            <div className="s-hd">
              <h2 className="s-title">Achievements</h2>
            </div>
            <div className="achievement-grid">
              {achievements.map((a, idx) => (
                <div key={idx} className={`achievement ${a.earned ? "earned" : ""}`}>
                  <div className="ach-icon" style={{ opacity: a.earned ? 1 : 0.3 }}>
                    {a.icon}
                  </div>
                  <div className="ach-name">{a.name}</div>
                  <div className="ach-desc">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="divider"></div>

          <div className="section">
            <div className="s-hd">
              <h2 className="s-title">Quick Links</h2>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn btn-s" onClick={() => router.push("/settings")}>
                ⚙ Settings
              </button>
              <button className="btn btn-s" onClick={() => router.push("/library?tab=completed")}>
                ✅ Completed
              </button>
              <button className="btn btn-s" onClick={() => router.push("/history")}>
                🕐 History
              </button>
              <button className="btn btn-s" onClick={() => router.push("/library?tab=collections")}>
                📁 Collections
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* GUEST AUTH GATE */
        <div className="guest-only">
          <div className="auth-gate">
            <div className="auth-gate-icon">👤</div>
            <h1 style={{fontSize: '18px'}}>Your Profile</h1>
            <p>Track reading time, earn achievements, and showcase your manga taste.</p>
            <div className="auth-gate-perks">
              <div className="auth-gate-perk">Reading stats and milestones</div>
              <div className="auth-gate-perk">Achievements and badges</div>
              <div className="auth-gate-perk">Public or private profile</div>
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
