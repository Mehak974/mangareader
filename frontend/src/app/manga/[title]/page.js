"use client";

import React, { use, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { fetchAnilist, getMangaList } from "@/utils/anilist";
import { slugify } from "@/utils/slugify";
import { sanitizeHtml } from "@/utils/sanitize";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";
import Loader, { MiniLoader } from "@/components/Loader";
import CommentSection from "@/components/CommentSection";
import { MANGA, ALL_CHAPTERS } from "@/data/mockData";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SINGLE_MANGA_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: MANGA) {
      id
      title {
        english
        romaji
        native
        userPreferred
      }
      coverImage {
        extraLarge
        large
        medium
      }
      description
      genres
      status
      averageScore
      popularity
      startDate {
        year
      }
    }
  }
`;

// Reading servers are exposed generically — provider brands are never shown to users.
const AVAILABLE_SOURCES = [
  { id: "mangaread", name: "Server 1" },
  { id: "coffeemanga", name: "Server 2" },
  { id: "mgeko", name: "Server 3" },
  { id: "isekaiscans", name: "Server 4" },
  { id: "mangakatana", name: "Server 5" },
  { id: "mangadex", name: "Server 6" }
];

const sourceLabel = (id) => AVAILABLE_SOURCES.find((s) => s.id === id)?.name || "Auto";

export default function MangaDetail({ params }) {
  const router = useRouter();
  const { title: titleSlug } = use(params);
  const {
    isBookmarked,
    toggleBookmark,
    readManga,
    toggleRead,
    addToHistory,
    isChapterRead,
    highestReadChapter,
    markChapterRead,
    toggleChapterReadState,
    setChaptersReadState,
    markAllBelowRead,
  } = useApp();

  const [manga, setManga] = useState(null);
  const [mangaId, setMangaId] = useState("");
  const [chapters, setChapters] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
const [chPage, setChPage] = useState(1);
   const [descExpanded, setDescExpanded] = useState(false);
   const [selectMode, setSelectMode] = useState(false);
   const [activeTab, setActiveTab] = useState('chapters');
   const [selected, setSelected] = useState(() => new Set()); // chapter numbers
   const CHS_PER_PAGE = 20;

   // eslint-disable-next-line react-hooks/set-state-in-effect
   useEffect(() => {
     setChPage(1);
     setSelected(new Set());
     setSelectMode(false);
   }, [titleSlug]);

  const longPressTimerRef = useRef(null);
  const LONG_PRESS_DURATION = 500;

  useEffect(() => {
    async function loadMangaDetail() {
      setLoading(true);

      // The slug is always a title-based string like "solo-leveling".
      // We search AniList / MAL by the human-readable title derived from it.
      const searchTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");

      try {
        // 1. Search AniList for the title
        let media = null;
        let normalizedManga = null;
        let resolvedId = "";

        const searchRes = await getMangaList({ search: searchTitle, perPage: 5 });
        if (searchRes && searchRes.media && searchRes.media.length > 0) {
          // Find an exact slug match first, fall back to first result
          const exactMatch = searchRes.media.find(
            (m) => slugify(m.t) === titleSlug
          );
          const bestMatch = exactMatch || searchRes.media[0];
          resolvedId = bestMatch.id;

          // If the slug doesn't match exactly, redirect to the canonical slug
          const canonicalSlug = slugify(bestMatch.t);
          if (canonicalSlug && canonicalSlug !== titleSlug) {
            router.replace(`/manga/${canonicalSlug}`);
            return;
          }

          // Now fetch full details from AniList using the resolved ID
          try {
            const cleanId = resolvedId.startsWith("mal-") 
              ? resolvedId.replace("mal-", "") 
              : resolvedId.startsWith("anilist-") 
                ? resolvedId.replace("anilist-", "") 
                : resolvedId;
            const aniData = await fetchAnilist(SINGLE_MANGA_QUERY, { id: parseInt(cleanId) });
            if (aniData && aniData.Media) {
              media = aniData.Media;
            }
          } catch (aniErr) {
            console.warn("AniList detail fetch failed:", aniErr.message);
          }
        }

        if (media) {
          const aniTitle = media.title.english || media.title.romaji || media.title.userPreferred;
          normalizedManga = {
            id: String(media.id),
            title: aniTitle,
            cover: media.coverImage.extraLarge || media.coverImage.large || media.coverImage.medium || "",
            description: media.description || "No description available.",
            status: media.status === "RELEASING" ? "RELEASING" : "FINISHED",
            rating: media.averageScore ? media.averageScore / 20 : 4.5,
            genres: media.genres || [],
            year: media.startDate?.year || "Unknown",
            popularity: media.popularity || 0,
          };
          resolvedId = String(media.id);
        } else if (resolvedId) {
          // We matched from getMangaList but couldn't get full details — use the search result data
          const matchData = searchRes?.media?.find(m => m.id === resolvedId);
          if (matchData) {
            normalizedManga = {
              id: resolvedId,
              title: matchData.t,
              cover: matchData.cover || "",
              description: "No detailed description available.",
              status: matchData.ongoing ? "RELEASING" : "FINISHED",
              rating: matchData.rating || 4.5,
              genres: matchData.genres || [matchData.g || "Action"],
              year: "Unknown",
              popularity: 0,
            };
          }
        }

        if (!normalizedManga) {
          console.warn("AniList detail fetch missed or returned no results for:", searchTitle);
          const fallbackCover = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cover') : '';
          
          normalizedManga = {
            id: `fallback-${slugify(searchTitle)}`,
            title: searchTitle,
            cover: fallbackCover || "",
            description: "Detailed description is not available in our database. You can still read the chapters below.",
            status: "RELEASING",
            rating: 4.5,
            genres: ["Ongoing"],
            year: "Unknown",
            popularity: 0,
          };
          resolvedId = normalizedManga.id;
        }

        setManga(normalizedManga);
        setMangaId(resolvedId);
        setLoading(false);

        // 2. Fetch mapped chapters from backend on the fly using the title
        setLoadingChapters(true);
        try {
          const mapRes = await fetch(`${apiBase}/api/manga/map?title=${encodeURIComponent(normalizedManga.title)}&mangaId=${encodeURIComponent(resolvedId)}`);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            if (mapData.data) {
              setChapters(mapData.data.chapters || []);
              setSourceId(mapData.data.sourceId || "");
              setSourceUrl(mapData.data.url || "");
              
              // Poll once after 12s in case background scrape found better source
              setTimeout(async () => {
                try {
                  const bgRes = await fetch(`${apiBase}/api/manga/map?title=${encodeURIComponent(normalizedManga.title)}&mangaId=${encodeURIComponent(resolvedId)}`);
                  if (bgRes.ok) {
                    const bgData = await bgRes.json();
                    if (bgData.data && bgData.data.chapters?.length > (mapData.data.chapters?.length || 0)) {
                      setChapters(bgData.data.chapters);
                      setSourceId(bgData.data.sourceId);
                      setSourceUrl(bgData.data.url);
                    }
                  }
                } catch (e) {}
              }, 12000);
            }
          }
        } catch (mapErr) {
          console.warn("Failed to dynamically map title to sources:", mapErr.message);
        } finally {
          setLoadingChapters(false);
        }

      } catch (err) {
        console.error("Failed to load manga details:", err.message);
        setLoading(false);
      }
    }

    if (titleSlug) {
      loadMangaDetail();
    }
  }, [titleSlug]);

  const handleSourceChange = async (newSourceId) => {
    if (!manga) return;
    setLoadingChapters(true);
    setChPage(1);
    try {
      const res = await fetch(`${apiBase}/api/manga/source-chapters?title=${encodeURIComponent(manga.title)}&source=${newSourceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setChapters(data.data.chapters || []);
          setSourceId(data.data.sourceId || "");
          setSourceUrl(data.data.url || "");
        }
      } else {
        setChapters([]);
        setSourceId(newSourceId);
        setSourceUrl("");
      }
    } catch (err) {
      console.warn("Failed to switch source:", err.message);
      setChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (!manga) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Failed to load manga</h2>
        <p>Manga &ldquo;{decodeURIComponent(titleSlug).replace(/-/g, " ")}&rdquo; could not be found.</p>
        <button className="btn btn-p" style={{ marginTop: "12px" }} onClick={() => router.push("/browse")}>
          Go Back
        </button>
      </div>
    );
  }

  const bookmarked = isBookmarked(mangaId);
  const isRead = readManga.includes(manga.title);
  const bookmarkPayload = {
    id: mangaId,
    t: manga.title,
    cover: manga.cover,
    ongoing: manga.status === "RELEASING",
    rating: manga.rating,
    g: manga.genres?.[0] || "",
  };

  // Pagination calculations
  const totalChapters = chapters.length;
  const highestRead = highestReadChapter(mangaId);
  const CH_TOTAL_PAGES = Math.max(1, Math.ceil(totalChapters / CHS_PER_PAGE));
  const startIndex = (chPage - 1) * CHS_PER_PAGE;
  const currentChapters = chapters.slice(startIndex, startIndex + CHS_PER_PAGE);

  // Build page range helper
  const buildPageRange = (cur, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (cur >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", cur - 1, cur, cur + 1, "...", total];
  };

  const handleReadChapterClick = (ch, idx) => {
    const chNum = totalChapters - idx;
    addToHistory(manga.title, ch.title || `Chapter ${chNum}`, chNum);
    markChapterRead(mangaId, chNum);
    router.push(`/reader/${chNum}?url=${encodeURIComponent(ch.href || "")}&source=${sourceId}&title=${encodeURIComponent(manga.title)}&mangaId=${encodeURIComponent(mangaId)}`);
  };

  // The tick beside a chapter toggles exactly that one chapter's read state.
  const toggleChapterRead = (e, chNum) => {
    e.stopPropagation();
    toggleChapterReadState(mangaId, chNum);
  };

  // ── Multi-select ─────────────────────────────────────────────────────────
  const toggleSelected = (chNum) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(chNum) ? next.delete(chNum) : next.add(chNum);
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const applyBulk = (read) => {
    if (selected.size === 0) return;
    setChaptersReadState(mangaId, [...selected], read);
    clearSelection();
  };

  const applyMarkAllBelow = () => {
    if (selected.size === 0) return;
    const selectedNums = [...selected];
    const maxSelected = Math.max(...selectedNums);
    const chaptersToMark = [];
    for (let ch = 1; ch <= maxSelected; ch++) {
      if (!selected.has(ch)) {
        chaptersToMark.push(ch);
      }
    }
    if (chaptersToMark.length > 0) {
      setChaptersReadState(mangaId, chaptersToMark, true);
    }
    clearSelection();
  };

  const handleLongPressStart = (chNum) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectMode(true);
      toggleSelected(chNum);
    }, LONG_PRESS_DURATION);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleLongPressMove = (e) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div>
      {/* MANGA HERO INFOS */}
      <div className="detail-hero">
        <div 
          className="detail-cover"
          style={
            manga.cover 
              ? { position: "relative", overflow: "hidden" }
              : {}
          }
        >
          {manga.cover ? (
            <Image
              src={manga.cover}
              alt={`Cover for ${manga.title}`}
              fill
              sizes="(max-width: 768px) 100vw, 350px"
              style={{ objectFit: "cover", objectPosition: "center" }}
              priority
            />
          ) : (
            "表紙"
          )}
          <div className="detail-cover-shimmer" style={{ position: "relative", zIndex: 1 }} />
        </div>
        <div>
          <div className="detail-meta-row">
            <span className={`badge ${manga.status === "RELEASING" ? "badge-ongoing" : "badge-done"}`}>
              {manga.status === "RELEASING" ? "● Ongoing" : "✓ Completed"}
            </span>
            {manga.genres && manga.genres.map((g) => (
              <span key={g} className="badge badge-genre">{g}</span>
            ))}
          </div>
          <h1 className="detail-title" id="detail-title">
            {manga.title}
          </h1>
          <div className="detail-rating">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>{" "}
            {parseFloat(manga.rating || 4.5).toFixed(1)}{" "}
            <span style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 400 }}>
              ({manga.popularity ? `${manga.popularity} popularity` : "N/A"})
            </span>
          </div>
          <div className={`detail-desc-container ${descExpanded ? "expanded" : ""}`}>
            <p className="detail-desc" dangerouslySetInnerHTML={{ __html: sanitizeHtml(manga.description) }} />
            {manga.description && manga.description.length > 200 && (
              <button className="show-more-btn" onClick={() => setDescExpanded(!descExpanded)}>
                {descExpanded ? "Show Less" : "Show More"}
              </button>
            )}
          </div>

          {/* Source Selection Row */}
          <div style={{ margin: "20px 0", display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "var(--text2)", fontWeight: "500" }}>Reading Source:</span>
            <select
              value={sourceId}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="themed-select"
            >
              {AVAILABLE_SOURCES.map(src => (
                <option key={src.id} value={src.id}>{src.name}</option>
              ))}
            </select>
          </div>

          <div className="detail-actions">
            {chapters.length > 0 ? (
              <>
                <button
                  className="btn btn-p"
                  onClick={() => handleReadChapterClick(chapters[chapters.length - 1], chapters.length - 1)}
                >
                  ▶ Read Ch 1
                </button>
                {(() => {
                  // Continue from the last chapter read; if none, start at Ch 1.
                  const continueChNum = highestRead > 0 ? Math.min(highestRead, totalChapters) : 1;
                  const continueIdx = totalChapters - continueChNum;
                  return (
                    <button
                      className="btn btn-s"
                      onClick={() => handleReadChapterClick(chapters[continueIdx], continueIdx)}
                    >
                      Continue Ch {continueChNum}
                    </button>
                  );
                })()}
              </>
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text3)", padding: "4px 0" }}>
                {loadingChapters ? "Searching selected source..." : "No active source mappings found on this provider."}
              </div>
            )}
            <button className="btn btn-s" onClick={() => toggleBookmark(bookmarkPayload)}>
              {bookmarked ? "★ In Library" : "＋ Library"}
            </button>
            <button className="btn btn-s" onClick={() => toggleRead(manga.title)}>
              {isRead ? "✓ Marked Read" : "✓ Mark Read"}
            </button>
          </div>

          <div className="detail-stats">
            <div className="d-stat">
              <b>{totalChapters}</b>
              <span>Chapters</span>
            </div>
            <div className="d-stat">
              <b>{manga.year}</b>
              <span>Year</span>
            </div>
            <div className="d-stat">
              <b>{manga.status === "RELEASING" ? "Ongoing" : "Complete"}</b>
              <span>Status</span>
            </div>
            <div className="d-stat">
              <b>{sourceId ? sourceLabel(sourceId) : "None"}</b>
              <span>Server</span>
            </div>
          </div>
        </div>
      </div>

      <div className="divider" />

{/* TABS */}
       <div className="manga-tabs manga-tabs--responsive">
         <button 
           className={`manga-tab ${activeTab === 'chapters' ? 'manga-tab--active' : ''}`}
           onClick={() => setActiveTab('chapters')}
         >
           Chapters
         </button>
         <button 
           className={`manga-tab ${activeTab === 'discussion' ? 'manga-tab--active' : ''}`}
           onClick={() => setActiveTab('discussion')}
         >
          Discussion
        </button>
      </div>

      <div className={`manga-detail-grid ${activeTab === 'chapters' ? 'active-chapters' : 'active-discussion'}`}>
        <div className="manga-detail-chapters">
          {/* CHAPTER LIST HEADER */}
          <div className="ch-list-header">
            <div className="s-title">
              Chapters{" "}
              <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text3)" }}>
                ({totalChapters} total)
              </span>
            </div>
            <button
              className="ch-select-btn"
              onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>

          {/* BULK ACTION BAR — visible only in select mode */}
          {selectMode && (
            <div className="ch-bulk-bar" role="toolbar" aria-label="Bulk chapter actions">
              <span className="ch-bulk-count">{selected.size} selected</span>
              <div className="ch-bulk-actions">
                <button
                  className="ch-bulk-btn"
                  disabled={selected.size === 0}
                  onClick={() => applyBulk(true)}
                >
                  ✓ Mark read
                </button>
                <button
                  className="ch-bulk-btn"
                  disabled={selected.size === 0}
                  onClick={() => applyBulk(false)}
                >
                  ○ Mark unread
                </button>
                <button
                  className="ch-bulk-btn ch-bulk-below"
                  disabled={selected.size === 0}
                  onClick={applyMarkAllBelow}
                  title="Mark this and all earlier chapters as read"
                >
                  ↧ Mark all below read
                </button>
              </div>
            </div>
          )}

          {/* CHAPTER LIST ROWS */}
          {loadingChapters ? (
            <MiniLoader />
          ) : (
            <div className="ch-list">
              {currentChapters.map((c, index) => {
                const chIndex = startIndex + index;
                const chNum = totalChapters - chIndex;
                const chRead = isChapterRead(mangaId, chNum);
                const isSelected = selected.has(chNum);
                const rowClick = selectMode
                  ? () => toggleSelected(chNum)
                  : () => handleReadChapterClick(c, chIndex);
                return (
                   <div
                     key={`${chIndex}-${c.href || chNum}`}
                     className={`ch-row ${chRead ? "ch-read" : ""} ${isSelected ? "ch-selected" : ""}`}
                     onClick={rowClick}
                     onTouchStart={() => handleLongPressStart(chNum)}
                     onTouchEnd={handleLongPressEnd}
                     onTouchMove={handleLongPressMove}
                     onContextMenu={(e) => {
                       e.preventDefault();
                       if (!selectMode) {
                         setSelectMode(true);
                         toggleSelected(chNum);
                       }
                     }}
                   >
                    {selectMode ? (
                      <span className="ch-checkbox" aria-hidden="true">
                        {isSelected ? "☑" : "☐"}
                      </span>
                    ) : (
                      <button
                        className="ch-read-toggle"
                        onClick={(e) => toggleChapterRead(e, chNum)}
                        title={chRead ? "Mark as unread" : "Mark as read"}
                        aria-label={chRead ? `Mark chapter ${chNum} as unread` : `Mark chapter ${chNum} as read`}
                        aria-pressed={chRead}
                      >
                        {chRead ? "✓" : "○"}
                      </button>
                    )}
                    <div className="ch-num">Ch {chNum}</div>
                    <div className="ch-title-txt">{c.title || `Chapter ${chNum}`}</div>
                    <div className="ch-actions">
                      {c.date && <div className="ch-date">{c.date}</div>}
                      {!selectMode && (
                        <>
                          <button
                            className="ch-below-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAllBelowRead(mangaId, chNum);
                            }}
                            title="Mark this and all earlier chapters as read"
                            aria-label={`Mark chapter ${chNum} and all below as read`}
                          >
                            ↧ read
                          </button>
                          <button
                            className="ch-play"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReadChapterClick(c, chIndex);
                            }}
                            aria-label={`Read chapter ${chNum}`}
                          >
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CHAPTER PAGINATION */}
          {!loadingChapters && CH_TOTAL_PAGES > 1 && (
            <div className="ch-pagination">
              <button
                className="pg-btn"
                onClick={() => setChPage((p) => Math.max(1, p - 1))}
                disabled={chPage === 1}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              {buildPageRange(chPage, CH_TOTAL_PAGES).map((pg, idx) => {
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
                    className={`pg-btn ${pg === chPage ? "active" : ""}`}
                    onClick={() => setChPage(pg)}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                className="pg-btn"
                onClick={() => setChPage((p) => Math.min(CH_TOTAL_PAGES, p + 1))}
                disabled={chPage === CH_TOTAL_PAGES}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <span className="pg-info">
                Page {chPage}/{CH_TOTAL_PAGES}
              </span>
            </div>
          )}
        </div>
        <div className="manga-detail-discussion">
          <CommentSection mangaId={mangaId} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
