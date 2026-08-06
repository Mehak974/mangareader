"use client";

import React, { useState, useEffect } from "react";
import MangaCard from "@/components/MangaCard";
import { getMangaList } from "@/utils/anilist";
import { ALL_GENRES } from "@/data/mockData";
import { useRouter } from "next/navigation";

export default function HomeGenreFilter() {
  const router = useRouter();
  const [activeGenre, setActiveGenre] = useState(null);
  const [popularInGenre, setPopularInGenre] = useState([]);
  const [loadingGenre, setLoadingGenre] = useState(false);

  useEffect(() => {
    if (!activeGenre) {
      setPopularInGenre([]);
      return;
    }
    setLoadingGenre(true);
    getMangaList({ genre: activeGenre, perPage: 24, sort: ["POPULARITY_DESC"] })
      .then((res) => {
        setPopularInGenre(res.media || []);
        setLoadingGenre(false);
      })
      .catch((err) => {
        console.warn("Genre fetch failed:", err.message);
        setPopularInGenre([]);
        setLoadingGenre(false);
      });
  }, [activeGenre]);

  return (
    <>
      {/* GENRES FILTER PANEL */}
      <div className="section">
        <div className="s-hd">
          <div className="s-title">Browse by Genre</div>
        </div>
        <div className="genre-row">
          {["Action", "Romance", "Fantasy", "Horror", "Historical", "Sports", "Drama", "Adventure", "Sci-Fi", "Comedy"].map((g) => (
            <button
              key={g}
              className={`genre-chip ${activeGenre === g ? "on" : ""}`}
              onClick={() => setActiveGenre(activeGenre === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>
        {activeGenre && (
          <div className="genre-popover open">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <b style={{ fontFamily: "var(--serif)", fontSize: "15px", color: "var(--accent)" }}>
                Popular in {activeGenre}
              </b>
              <button
                style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "16px" }}
                onClick={() => setActiveGenre(null)}
              >
                ✕
              </button>
            </div>
            {loadingGenre ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>Loading...</div>
            ) : (
              <div className="manga-grid">
                {popularInGenre.map((m, idx) => (
                   <MangaCard key={m.id} manga={m} index={idx} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
