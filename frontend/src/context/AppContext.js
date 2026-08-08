"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchApi } from "@/utils/api";

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signinSheetOpen, setSigninSheetOpen] = useState(false);
  const [navDropOpen, setNavDropOpen] = useState(false);
  const [mobSearchOpen, setMobSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // App settings & session states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); // { id, email, displayName, role } or null
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [isIncognito, setIsIncognito] = useState(false);
  const [isNSFW, setIsNSFW] = useState(false);
  const [accentColors, setAccentColors] = useState({ c1: "#FFB300", c2: "#FFCA28" });

  // Custom User Preferences Settings
  const [compactCards, setCompactCards] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [readingDirection, setReadingDirection] = useState("Right to left");
  const [pageFit, setPageFit] = useState("Fit width");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [preloadPages, setPreloadPages] = useState(true);
  const [savePosition, setSavePosition] = useState(true);

  // User reading preferences/progress states
  const [hiddenGenres, setHiddenGenres] = useState([]);
  const [userInterests, setUserInterests] = useState([]);
  const [readManga, setReadManga] = useState([]); // array of titles
  const [readingHistory, setReadingHistory] = useState([]); // array of {t, ch, chNum, time}
  const [bookmarks, setBookmarks] = useState([]); // legacy local bookmarks, or derived from libraries
  const [readChapters, setReadChapters] = useState({}); // { [mangaId]: number[] of read chapter numbers }
  const [hydrated, setHydrated] = useState(false);

  // Multi-library states
  const [libraries, setLibraries] = useState([]);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryPickerManga, setLibraryPickerManga] = useState(null);

  const loadLocalState = (uid) => {
    try {
      const key = uid ? `mr:state:${uid}` : "mr:state:guest";
      let raw = localStorage.getItem(key);
      
      // Migrate old data if the new key doesn't exist, OR if it was accidentally wiped
      // and contains no reading history/bookmarks (fixing the previous reset bug).
      let needsMigration = !raw;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.readingHistory?.length && !Object.keys(parsed.readChapters || {}).length && !parsed.bookmarks?.length) {
          needsMigration = true;
        }
      }

      if (needsMigration) {
        const legacy = localStorage.getItem("mr:state");
        if (legacy) {
          raw = legacy;
          localStorage.setItem(key, raw);
        }
      }
      
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.bookmarks)) setBookmarks(s.bookmarks);
        if (Array.isArray(s.readManga)) setReadManga(s.readManga);
        if (Array.isArray(s.readingHistory)) setReadingHistory(s.readingHistory);
        if (s.readChapters && typeof s.readChapters === "object") {
          setReadChapters(s.readChapters);
        } else if (s.chapterProgress && typeof s.chapterProgress === "object") {
          const migrated = {};
          for (const [id, n] of Object.entries(s.chapterProgress)) {
            const high = Number(n) || 0;
            if (high > 0) migrated[id] = Array.from({ length: high }, (_, i) => i + 1);
          }
          setReadChapters(migrated);
        }
      }
    } catch (_) {}
  };

  const fetchLibraries = async () => {
    try {
      const res = await fetch("/api/library", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setLibraries(json.data || []);
        // Sync flat bookmarks array for backward compatibility
        const flatBookmarks = (json.data || []).flatMap((lib) => 
          (lib.manga || []).map(m => ({ id: m.mangaId, t: m.title, cover: m.cover, ongoing: m.ongoing, rating: m.rating, g: m.genre }))
        );
        // Deduplicate
        const uniqueBookmarks = Array.from(new Map(flatBookmarks.map(item => [item.id, item])).values());
        setBookmarks(uniqueBookmarks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Restore the logged-in user from the httpOnly session cookie on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
          setIsLoggedIn(true);
          // If the backend has history, we can load it. For now we load local state.
          loadLocalState(data.user.id);
          fetchLibraries();
        } else {
          loadLocalState(null);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          loadLocalState(null);
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist reading data whenever it changes (skip until initial hydration to avoid clobbering)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const key = user ? `mr:state:${user.id}` : "mr:state:guest";
      localStorage.setItem(
        key,
        JSON.stringify({ bookmarks, readManga, readingHistory, readChapters })
      );
      
      // Debounce and sync to backend if logged in
      if (user) {
        const timeout = setTimeout(() => {
          fetch("/api/history/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ readingHistory, readChapters })
          }).catch(() => {});
        }, 3000);
        return () => clearTimeout(timeout);
      }
    } catch (_) {
      // quota or serialization failure — non-fatal
    }
  }, [hydrated, bookmarks, readManga, readingHistory, readChapters, user]);

  // Sync theme to root html element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Sync accent colors to root element styling
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accentColors.c1);
    root.style.setProperty("--accent2", accentColors.c2);
    root.style.setProperty("--accent-bg", accentColors.c1 + "1a");
    root.style.setProperty("--accent-border", accentColors.c1 + "40");
  }, [accentColors]);

  // Sync body class for incognito mode styling
  useEffect(() => {
    if (isIncognito) {
      document.body.classList.add("incognito");
    } else {
      document.body.classList.remove("incognito");
    }
  }, [isIncognito]);

  // Sync body class for logged-in styling
  useEffect(() => {
    if (isLoggedIn) {
      document.body.classList.add("logged-in");
    } else {
      document.body.classList.remove("logged-in");
    }
  }, [isLoggedIn]);

  // Actions
  const toggleDark = (dark) => {
    setIsDark(dark !== undefined ? dark : !isDark);
  };

  const setAccent = (c1, c2) => {
    setAccentColors({ c1, c2 });
  };

  const toggleIncognito = () => {
    setIsIncognito((prev) => !prev);
  };

  const toggleNSFW = (enabled) => {
    setIsNSFW(enabled);
  };

  const hideGenre = (genre) => {
    if (!hiddenGenres.includes(genre)) {
      setHiddenGenres((prev) => [...prev, genre]);
    }
  };

  const unhideGenre = (genre) => {
    setHiddenGenres((prev) => prev.filter((g) => g !== genre));
  };

  const toggleRead = (title) => {
    setReadManga((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const addToHistory = (title, ch, chNum, url, source, mangaId, cover) => {
    if (isIncognito) return;
    setReadingHistory((prev) => {
      const filtered = prev.filter((h) => h.t !== title);
      return [{ t: title, ch, chNum, url, source, mangaId, cover, time: new Date() }, ...filtered];
    });
  };

  const clearHistory = () => {
    setReadingHistory([]);
  };

  // Accepts a manga object {id, t, cover, ongoing, rating, g}. Toggles by id.
  // Library requires an account — prompt sign-in instead of bookmarking when logged out.
  const toggleBookmark = async (manga) => {
    if (!isLoggedIn) {
      setSigninSheetOpen(true);
      return;
    }
    const item = typeof manga === "string" ? { id: manga, t: manga } : manga;
    
    // Check if it's already in any library
    const inLibraries = libraries.filter(lib => lib.manga?.some(m => String(m.mangaId) === String(item.id)));
    
    if (inLibraries.length > 0) {
      // If it is, remove it from all libraries (toggle off behavior)
      await Promise.all(inLibraries.map(lib => removeFromLibrary(lib.id, item.id)));
    } else {
      // If it isn't, open the picker
      setLibraryPickerManga(item);
      setLibraryPickerOpen(true);
    }
  };

  const isBookmarked = (id) => bookmarks.some((b) => String(b.id) === String(id));

  // ── Multi-Library Actions ────────────────────────────────────────────────
  
  const createLibrary = async (name) => {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) await fetchLibraries();
  };

  const deleteLibrary = async (id) => {
    const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
    if (res.ok) await fetchLibraries();
  };

  const addToLibrary = async (libraryId, manga) => {
    const res = await fetch("/api/library/manga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId, manga }),
    });
    if (res.ok) await fetchLibraries();
  };

  const removeFromLibrary = async (libraryId, mangaId) => {
    const res = await fetch("/api/library/manga", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId, mangaId }),
    });
    if (res.ok) await fetchLibraries();
  };

  // ── Per-chapter read state ───────────────────────────────────────────────
  // Model: readChapters[mangaId] is an array of chapter numbers marked read.
  // A Set is used internally per update for O(1) membership, stored back as a
  // sorted array so it serialises cleanly to localStorage.

  const isChapterRead = (mangaId, chapterNumber) =>
    !!readChapters[mangaId]?.includes(chapterNumber);

  // Highest read chapter — used by the "Continue" button. 0 if none read.
  const highestReadChapter = (mangaId) => {
    const list = readChapters[mangaId];
    return list && list.length ? Math.max(...list) : 0;
  };

  // Mutate one manga's read-set with a function receiving/returning a Set.
  const updateReadSet = (mangaId, fn) => {
    if (!mangaId) return;
    setReadChapters((prev) => {
      const set = new Set(prev[mangaId] || []);
      fn(set);
      if (set.size === 0) {
        const { [mangaId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [mangaId]: [...set].sort((a, b) => a - b) };
    });
  };

  // Mark a single chapter read (used when opening the reader — never unreads).
  const markChapterRead = (mangaId, chapterNumber) => {
    if (!chapterNumber) return;
    updateReadSet(mangaId, (set) => set.add(chapterNumber));
  };

  // Toggle a single chapter's read state.
  const toggleChapterReadState = (mangaId, chapterNumber) => {
    if (!chapterNumber) return;
    updateReadSet(mangaId, (set) =>
      set.has(chapterNumber) ? set.delete(chapterNumber) : set.add(chapterNumber)
    );
  };

  // Mark an explicit list of chapter numbers read or unread (bulk selection).
  const setChaptersReadState = (mangaId, chapterNumbers, read) => {
    if (!chapterNumbers?.length) return;
    updateReadSet(mangaId, (set) => {
      for (const n of chapterNumbers) read ? set.add(n) : set.delete(n);
    });
  };

  // Mark every chapter with number <= chapterNumber as read ("mark all below").
  const markAllBelowRead = (mangaId, chapterNumber) => {
    if (!chapterNumber) return;
    updateReadSet(mangaId, (set) => {
      for (let n = 1; n <= chapterNumber; n++) set.add(n);
    });
  };

  // Real auth against the /api/auth routes. Each returns { ok, error? } so
  // pages can show inline validation/error states without throwing.
  const doLogin = async ({ email, password }) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Login failed." };
      setUser(data.user);
      setIsLoggedIn(true);
      setSigninSheetOpen(false);
      fetchLibraries();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  };

  const doSignup = async ({ email, password, displayName }) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Sign up failed." };
      setUser(data.user);
      setIsLoggedIn(true);
      setSigninSheetOpen(false);
      fetchLibraries();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  };

  const doSignout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore — clear client state regardless
    }
    setUser(null);
    setIsLoggedIn(false);
    setLibraries([]);
    setBookmarks([]);
    loadLocalState(null); // Load guest history
  };

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        signinSheetOpen,
        setSigninSheetOpen,
        navDropOpen,
        setNavDropOpen,
        mobSearchOpen,
        setMobSearchOpen,
        searchQuery,
        setSearchQuery,
        isLoggedIn,
        setIsLoggedIn,
        user,
        isDark,
        toggleDark,
        isIncognito,
        toggleIncognito,
        isNSFW,
        toggleNSFW,
        accentColors,
        setAccent,
        hiddenGenres,
        hideGenre,
        unhideGenre,
        userInterests,
        setUserInterests,
        readManga,
        toggleRead,
        readingHistory,
        addToHistory,
        clearHistory,
        bookmarks,
        toggleBookmark,
        isBookmarked,
        readChapters,
        isChapterRead,
        highestReadChapter,
        markChapterRead,
        toggleChapterReadState,
        setChaptersReadState,
        markAllBelowRead,
        libraries,
        libraryPickerOpen,
        setLibraryPickerOpen,
        libraryPickerManga,
        setLibraryPickerManga,
        createLibrary,
        deleteLibrary,
        addToLibrary,
        removeFromLibrary,
        fetchLibraries,
        doLogin,
        doSignup,
        doSignout,
        compactCards,
        setCompactCards,
        reduceMotion,
        setReduceMotion,
        readingDirection,
        setReadingDirection,
        pageFit,
        setPageFit,
        autoAdvance,
        setAutoAdvance,
        preloadPages,
        setPreloadPages,
        savePosition,
        setSavePosition,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
