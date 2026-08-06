"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { getMangaList, isExplicitNSFW } from "@/utils/anilist";
import MangaCard from "@/components/MangaCard";
import MangaSkeleton from "@/components/MangaSkeleton";
import Footer from "@/components/Footer";

// All popular genres from AniList
const ANILIST_GENRES = [
  "All",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

function BrowseContent() {
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery, isNSFW } = useApp();
  // Helper: apply NSFW filter logic
  // - Always show non-NSFW content
  // - Show NSFW if filter is OFF (isNSFW = true)
  // - Show NSFW if user explicitly searched for it (query matches title), even with filter ON
  // - Otherwise hide completely
  const applyNsfwFilter = (list) => list.filter(m => {
    const genres = m.genres || (m.g ? [m.g] : []);
    const titleStr = m.t || m.title || "";
    const extra = { tags: m.tags, isAdult: m.isAdult };
    if (!isExplicitNSFW(genres, titleStr, extra)) return true; // non-NSFW always shown
    if (isNSFW) return true; // filter OFF → show all NSFW (cover will be blurred by MangaCard)
    // filter ON but user searched for this specific title → show it with cover warning
    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      if (titleStr.toLowerCase().includes(q)) return true;
    }
    return false; // filter ON, no matching query → hide completely
  });

  const [sort, setSort] = useState("Trending");
  const [status, setStatus] = useState("All Statuses");
  const [activeGenre, setActiveGenre] = useState("All");

  // Advanced Filters State
  const [year, setYear] = useState("All");
  const [rating, setRating] = useState("All");
  const [country, setCountry] = useState("All");

const [page, setPage] = useState(1);
   const [mangaList, setMangaList] = useState([]);
   const [pageInfo, setPageInfo] = useState({ currentPage: 1, lastPage: 1, hasNextPage: false });
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

  const perPage = 36;

  // Read search parameters for initial values
  useEffect(() => {
    const sortParam = searchParams.get("sort");
    if (sortParam) {
      if (sortParam === "trending") setSort("Trending");
      else if (sortParam === "latest") setSort("New Releases");
      else if (sortParam === "completed") setSort("Completed");
    }

    const q = searchParams.get("q");
    if (q) setSearchQuery(q);

    const genreParam = searchParams.get("genre");
    if (genreParam) {
      setActiveGenre(genreParam);
    }
  }, [searchParams]);

  // Reset to page 1 when any filter changes or when page size changes (e.g. mobile toggle)
  useEffect(() => {
    setPage(1);
  }, [sort, status, activeGenre, year, rating, country, searchQuery, perPage]);

  // Fetch manga on filter or page changes
  useEffect(() => {
    let activeSort = ["TRENDING_DESC", "POPULARITY_DESC"];
    if (sort === "Top Rated") activeSort = ["SCORE_DESC", "POPULARITY_DESC"];
    else if (sort === "New Releases") activeSort = ["ID_DESC"];
    else if (sort === "A–Z") activeSort = ["TITLE_ROMAJI"];

    let activeStatus = undefined;
    if (status === "Ongoing") activeStatus = "RELEASING";
    else if (status === "Completed") activeStatus = "FINISHED";

    const fetchVariables = {
      page,
      perPage: perPage,
      sort: activeSort,
      status: activeStatus,
    };
    if (activeGenre !== "All") fetchVariables.genre = activeGenre;
    if (searchQuery.trim()) fetchVariables.search = searchQuery.trim();

    setLoading(true);
    getMangaList(fetchVariables).then((aniRes) => {
      if (aniRes.media && aniRes.media.length > 0) {
        setMangaList(applyNsfwFilter(aniRes.media));
        setPageInfo(aniRes.pageInfo);
        setError(null);
      } else {
        setMangaList([]);
        setPageInfo({ currentPage: page, lastPage: 1, hasNextPage: false, total: 0 });
        setError(null);
      }
      setLoading(false);
    }).catch(() => {
      setMangaList([]);
      setPageInfo({ currentPage: page, lastPage: 1, hasNextPage: false, total: 0 });
      setError("Failed to fetch results");
      setLoading(false);
    });
  }, [page, sort, status, activeGenre, year, rating, country, searchQuery, perPage]);

  const handleGenreTagClick = (g) => {
    setActiveGenre(g);
  };

  const handleResetFilters = () => {
    setSort("Trending");
    setStatus("All Statuses");
    setActiveGenre("All");
    setYear("All");
    setRating("All");
    setCountry("All");
  };

  // Build page range helper for pagination
  const buildPageRange = (cur, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (cur >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", cur - 1, cur, cur + 1, "...", total];
  };

  return (
    <div>
      <div className="browse-hero">
        <h1>Browse Manga</h1>

        {/* Advanced Filters Panel */}
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="sort-select">Sort</label>
            <select id="sort-select" className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option>Trending</option>
              <option>Top Rated</option>
              <option>New Releases</option>
              <option>A–Z</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="status-select">Status</label>
            <select id="status-select" className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All Statuses</option>
              <option>Ongoing</option>
              <option>Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="year-select">Year</label>
            <select id="year-select" className="filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="All">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="rating-select">Min Rating</label>
            <select id="rating-select" className="filter-select" value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="All">Any Rating</option>
              <option value="4.5">★ 4.5+</option>
              <option value="4.0">★ 4.0+</option>
              <option value="3.5">★ 3.5+</option>
              <option value="3.0">★ 3.0+</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="country-select">Origin</label>
            <select id="country-select" className="filter-select" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="All">Any Country</option>
              <option value="JP">Japan</option>
              <option value="KR">Korea</option>
              <option value="CN">China</option>
            </select>
          </div>

          <div className="filter-group" style={{ display: "flex", alignItems: "flex-end" }}>
            <button 
              className="btn btn-s" 
              onClick={handleResetFilters}
              style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Genres tag list */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", width: "100%" }}>
          {ANILIST_GENRES.map((g) => (
            <button
              key={g}
              className={`f-tag ${activeGenre === g ? "on" : ""}`}
              onClick={() => handleGenreTagClick(g)}
              style={{ flexShrink: 0 }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="section" style={{ minHeight: "400px" }}>
          {loading ? (
            <div className="manga-grid browse-grid">
              <MangaSkeleton count={36} />
            </div>
          ) : error && !mangaList.length ? (
           <div style={{ textAlign: "center", padding: "60px 20px" }}>
             <h3 style={{ color: "var(--red)", marginBottom: "12px" }}>Unable to load manga</h3>
             <p style={{ color: "var(--text3)", marginBottom: "16px" }}>{error}</p>
             <button className="btn btn-p" onClick={() => window.location.reload()}>Retry</button>
           </div>
         ) : mangaList.length ? (
           <>
             {error && (
               <div style={{ textAlign: "center", padding: "8px", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: "var(--r)", marginBottom: "16px" }}>
                 <span style={{ color: "var(--accent)", fontSize: "13px" }}>{error}</span>
               </div>
             )}

             <div className="manga-grid browse-grid">
               {mangaList.map((m, idx) => (
                 <MangaCard key={m.id} manga={m} index={idx} />
               ))}
             </div>

             {/* Pagination Controls */}
             {pageInfo.lastPage > 1 && (
               <div className="ch-pagination" style={{ marginTop: "32px", justifyContent: "center" }}>
                  <button
                    className="pg-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                     <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                   </svg>
                 </button>

                 {buildPageRange(page, pageInfo.lastPage).map((pg, idx) => {
                   if (pg === "...") {
                     return (
                       <span key={idx} className="pg-ellipsis">
                         …
                       </span>
                     );
                   }
                   return (
                     <button
                       key={idx}
                       className={`pg-btn ${pg === page ? "active" : ""}`}
                       onClick={() => setPage(pg)}
                     >
                       {pg}
                     </button>
                   );
                 })}

                  <button
                    className="pg-btn"
                    onClick={() => setPage((p) => Math.min(pageInfo.lastPage, p + 1))}
                    disabled={page === pageInfo.lastPage}
                    aria-label="Next page"
                  >
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                     <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                   </svg>
                 </button>
                 <span className="pg-info">
                   Page {page}/{pageInfo.lastPage}
                 </span>
               </div>
             )}
           </>
         ) : (
           <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text3)" }}>
             <h3>No matches found</h3>
             <p style={{ marginTop: "8px", fontSize: "13px" }}>Try adjusting your filters or search query.</p>
           </div>
         )}
       </div>


      <Footer />
    </div>
  );
}

export default function Browse() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: "center", padding: "40px" }}>
        <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}>Browse Manga</h1>
        Loading...
      </div>
    }>
      <BrowseContent />
    </Suspense>
  );
}
