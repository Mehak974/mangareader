"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { MANGA, abbr } from "@/data/mockData";
import { slugify } from "@/utils/slugify";
import { fetchAnilist, MANGA_QUERY } from "@/utils/anilist";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef(null);
   const searchWrapRef = useRef(null);

  const {
    sidebarOpen,
    setSidebarOpen,
    signinSheetOpen,
    setSigninSheetOpen,
    navDropOpen,
    setNavDropOpen,
    searchQuery,
    setSearchQuery,
    isLoggedIn,
    user,
    isDark,
    toggleDark,
    isIncognito,
    doLogin,
    doSignout,
  } = useApp();

  // Keyboard shortcut '/' to focus search, Escape to clear
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
return () => document.removeEventListener("keydown", handleKeyDown);
   }, []);

   const [showSuggestions, setShowSuggestions] = useState(false);

   // Close search dropdown on outside click
   useEffect(() => {
     const handleClickOutside = (e) => {
       if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
         setShowSuggestions(false);
       }
     };
     document.addEventListener("mousedown", handleClickOutside);
     return () => document.removeEventListener("mousedown", handleClickOutside);
   }, []);

   // Clear search on browser back/forward navigation (not on reload)
   useEffect(() => {
     const handlePopState = () => {
       setSearchQuery("");
       setShowSuggestions(false);
     };
     window.addEventListener("popstate", handlePopState);
     return () => window.removeEventListener("popstate", handlePopState);
   }, [setSearchQuery, setShowSuggestions]);



   const [results, setResults] = useState([]);
   const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    setSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        let resultsData = null;
        const aniData = await fetchAnilist(MANGA_QUERY, { search: q, perPage: 6 });
        if (aniData && aniData.Page && aniData.Page.media) {
          resultsData = aniData.Page.media;
        } else {
          // Fallback to MyAnimeList Jikan API
          const jikanRes = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=6`);
          if (jikanRes.ok) {
            const jikanData = await jikanRes.json();
            if (jikanData.data) {
              resultsData = jikanData.data.map(item => ({
                id: `mal-${item.mal_id}`,
                title: {
                  english: item.title_english,
                  romaji: item.title,
                  userPreferred: item.title
                },
                genres: (item.genres || []).map(g => g.name),
                coverImage: {
                  medium: item.images?.jpg?.image_url || ""
                }
              }));
            }
          }
        }

        if (resultsData) {
          const formatted = resultsData.map(media => {
            const title = media.title.english || media.title.romaji || media.title.userPreferred || media.title.native;
            return {
              id: media.id,
              t: title,
              g: media.genres ? (Array.isArray(media.genres) ? media.genres.join(", ") : media.genres) : "Action",
              cover: media.coverImage?.medium || ""
            };
          });
          setResults(formatted);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Search error:", err.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle Search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Perform search filtering
  const searchMatches = results;

  const searchResultsLabel = searchQuery.trim()
    ? (searching ? "Searching..." : `Results for "${searchQuery.trim()}"`)
    : "";

  // Hide header in reader mode
  if (pathname?.startsWith("/reader")) {
    return null;
  }

  return (
    <>
      {/* INCOGNITO BANNER */}
      <div className={`incognito-bar ${isIncognito ? "on" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        Incognito mode — reading history won&apos;t be saved
      </div>

      {/* NAV BAR */}
      <nav className="nav" id="main-nav">
        <button
          className="nav-ham"
          onClick={() => setSidebarOpen(true)}
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12h18M3 6h18M3 18h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <Link href="/" className="logo">
          manga <span>reader</span>
        </Link>

{/* SEARCH BAR CONTAINER */}
         <div className="nav-search-wrap" ref={searchWrapRef}>
          <div className="nav-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M21 21l-4.3-4.3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>             <input
               type="text"
               ref={searchInputRef}
               placeholder="Search titles, genres…"
               aria-label="Search manga"
               value={searchQuery}
               onChange={handleSearchChange}
               onFocus={() => setShowSuggestions(true)}
               onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
               onKeyDown={(e) => {
                 if (e.key === "Enter") {
                   router.push(`/browse`);
                   setShowSuggestions(false);
                   searchInputRef.current?.blur();
                 }
                 if (e.key === "Escape") {
                   setSearchQuery("");
                   setShowSuggestions(false);
                   searchInputRef.current?.blur();
                 }
               }}
               autoComplete="off"
             />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setShowSuggestions(false);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text3)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "4px"
                  }}
                  aria-label="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {!searchQuery && <span className="nav-search-kbd">/</span>}
              <button
                className="nav-search-submit-btn"
                onClick={() => {
                  if (searchQuery.trim()) {
                    router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
                    setShowSuggestions(false);
                    searchInputRef.current?.blur();
                  }
                }}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  color: "var(--bg)",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
                aria-label="Submit search"
              >
                Search
              </button>
           </div>

          {/* SEARCH DROPDOWN */}
          {showSuggestions && searchQuery !== "" && (
            <div className="search-drop open">
              {searchResultsLabel && (
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "var(--text3)",
                    padding: "8px 12px 4px",
                    fontWeight: "700",
                  }}
                >
                  {searchResultsLabel}
                </div>
              )}
              {searchMatches.length ? (
                searchMatches.map((m) => (
                  <div
                    key={m.id}
                    className="sr-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      router.push(`/manga/${slugify(m.t)}`);
                      setSearchQuery("");
                    }}
                  >
                    <div 
                      className="sr-cov"
                      style={
                        m.cover 
                          ? { position: "relative", overflow: "hidden", color: "transparent" }
                          : {}
                      }
                    >
                      {m.cover ? (
                        <Image
                          src={m.cover}
                          alt={`Cover for ${m.t}`}
                          fill
                          sizes="40px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        abbr(m.t)
                      )}
                    </div>
                    <div>
                      <div className="sr-title">{m.t}</div>
                      <div className="sr-meta">{m.g}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sr-item" style={{ cursor: "default" }}>
                  <div className="sr-title" style={{ color: "var(--text3)" }}>
                    No results for &quot;{searchQuery.trim()}&quot;
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT ACTION BUTTONS */}
        <div className="nav-right">
          <button
            className="icon-btn"
            id="theme-btn"
            title="Toggle theme"
            aria-label="Toggle dark mode"
            onClick={() => toggleDark()}
          >
            <svg id="theme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
              {isDark ? (
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              ) : (
                <>
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>

          {/* Guest Sign In Trigger */}
          {!isLoggedIn ? (
            <button
              className="nav-cta guest-only"
              onClick={() => setSigninSheetOpen(true)}
            >
              Sign In
            </button>
          ) : (
            /* Auth Profile Dropdown Trigger */
            <div className={`nav-profile ${navDropOpen ? "open" : ""}`}>
              <div
                className="nav-avatar"
                role="button"
                tabIndex={0}
                aria-label="Open user menu"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setNavDropOpen(!navDropOpen);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setNavDropOpen(!navDropOpen);
                }}
              >
                {(user?.displayName || "?").charAt(0).toUpperCase()}
              </div>

              {navDropOpen && (
                <div className="nav-drop">
                  <div className="nav-drop-header">
                    <div className="nav-drop-av">{(user?.displayName || "?").charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="nav-drop-name">Tsukasa</div>
                      <div className="nav-drop-handle">@tsukasa</div>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    className="dd-item"
                    onClick={() => setNavDropOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    My Profile
                  </Link>
                  <Link
                    href="/library"
                    className="dd-item"
                    onClick={() => setNavDropOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
                    href="/history"
                    className="dd-item"
                    onClick={() => setNavDropOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
                  <div className="dd-div"></div>
                  <Link
                    href="/settings"
                    className="dd-item"
                    onClick={() => setNavDropOpen(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                    Settings
                  </Link>
                  <div className="dd-div"></div>
                  <button
                    className="dd-item red"
                    onClick={() => {
                      doSignout();
                      setNavDropOpen(false);
                      router.push("/");
                    }}
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
                </div>
              )}
            </div>
          )}
        </div>
      </nav>



      {/* GUEST SIGN-IN SHEET */}
      {signinSheetOpen && (
        <div
          className="sheet-back open"
          onClick={(e) => {
            if (e.target.classList.contains("sheet-back")) {
              setSigninSheetOpen(false);
            }
          }}
        >
          <div className="sheet">
            <div className="sheet-handle"></div>
            <div className="sheet-title">Pick up where you left off</div>
            <div className="sheet-sub">
              Sign in to sync progress, get personalised recs, and read offline
              — free forever.
            </div>
            <button
              className="btn btn-p btn-block"
              onClick={() => {
                setSigninSheetOpen(false);
                router.push("/login");
              }}
            >
              Sign in
            </button>
            <button
              className="btn btn-s btn-block"
              onClick={() => {
                setSigninSheetOpen(false);
                router.push("/signup");
              }}
            >
              Create account
            </button>
            <button
              className="btn btn-s btn-block"
              style={{ opacity: 0.6 }}
              onClick={() => setSigninSheetOpen(false)}
            >
              Maybe later
            </button>
            <div className="sheet-perks">
              <div className="sheet-perk">No ads</div>
              <div className="sheet-perk">Sync</div>
              <div className="sheet-perk">Offline</div>
              <div className="sheet-perk">Alerts</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
