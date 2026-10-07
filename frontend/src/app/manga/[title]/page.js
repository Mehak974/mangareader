"use client";

import React, { use, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { fetchAnilist, getMangaList, isExplicitNSFW } from "@/utils/anilist";
import { slugify } from "@/utils/slugify";
import { sanitizeHtml } from "@/utils/sanitize";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";
import Loader, { MiniLoader } from "@/components/Loader";
import CommentSection from "@/components/CommentSection";
import MangaNote from "@/components/MangaNote";
import { MANGA, abbr, COVER_GRADS } from "@/data/mockData";
import { API_BASE, proxyImage } from "@/utils/api";
import {
  readDetail,
  writeDetail,
  isFresh,
  clearDetail,
  readCover,
  writeCover,
  seedCover,
  markViewedOnce,
} from "@/utils/detailCache";
import { HILLTOP_DIRECT_LINK } from "@/lib/site-config";
import { getOfflineChaptersForManga, deleteOfflineChapter, deleteOfflineManga, makeChapterAvailableOffline, preloadOfflineChapter } from "@/utils/offlineStorage";
import RewardedAdModal from "@/components/RewardedAdModal";
import { fetchChapterImagesThroughWorker } from "@/utils/api";
import toast from "react-hot-toast";

const apiBase = API_BASE;

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
  { id: "mangakatana", name: "Server 2" },
  { id: "manganato", name: "Server 3" }
];

const sourceLabel = (id) => AVAILABLE_SOURCES.find((s) => s.id === id)?.name || "Auto";

export default function MangaDetail({ params }) {
  const router = useRouter();
  const { title: titleSlug } = use(params);
  const searchParams = useSearchParams();
  const queryCover = searchParams ? searchParams.get("cover") || "" : "";
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
    isNSFW,
  } = useApp();

  const [manga, setManga] = useState(null);
  const [mangaId, setMangaId] = useState("");
  const [chapters, setChapters] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  // Cover candidates are tried in order via coverIndex. Source-site covers
  // (Server 1–3) 403 through the image proxy fairly often, so the AniList
  // cover is kept as a known-good second choice; an exhausted list falls back
  // to the gradient placeholder rather than a broken image.
  const [coverAlt, setCoverAlt] = useState("");
  const [coverIndex, setCoverIndex] = useState(0);
  const coverCandidates = [manga?.cover, coverAlt].filter(Boolean);
  const primaryCover = coverCandidates[coverIndex] || "";

  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
const [chPage, setChPage] = useState(1);
   const [chSearchQuery, setChSearchQuery] = useState("");
   const [descExpanded, setDescExpanded] = useState(false);
   const [selectMode, setSelectMode] = useState(false);
   const [activeTab, setActiveTab] = useState('chapters');
   const [selected, setSelected] = useState(() => new Set()); // chapter numbers
   const [offlineChapters, setOfflineChapters] = useState(() => new Set());
   const [downloadModalOpen, setDownloadModalOpen] = useState(false);
   const [downloadTarget, setDownloadTarget] = useState(null);
   const [downloadProgress, setDownloadProgress] = useState(null);
   const [downloadingChapters, setDownloadingChapters] = useState({}); // { [chNum]: percent }
   const CHS_PER_PAGE = 20;

   useEffect(() => {
     if (!mangaId && !manga?.title && !titleSlug) return;
     const loadOffline = () => {
       getOfflineChaptersForManga(mangaId, manga?.title || titleSlug).then((items) => {
         const set = new Set(items.map((item) => Number(item.chapterNum) || item.chapterNum));
         setOfflineChapters(set);
       });
     };
     loadOffline();
     window.addEventListener('offline-chapters-updated', loadOffline);
     return () => window.removeEventListener('offline-chapters-updated', loadOffline);
   }, [mangaId, manga?.title, titleSlug]);

    useEffect(() => {
      setChPage(1);
      setSelected(new Set());
      setSelectMode(false);
      setCoverIndex(0);
      redirectDoneRef.current = false;
    }, [titleSlug]);

  const longPressTimerRef = useRef(null);
  const LONG_PRESS_DURATION = 500;

  const redirectDoneRef = useRef(false);
  const coverCacheRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadMangaDetail() {
      // The slug is always a title-based string like "solo-leveling".
      // We search AniList / MAL by the human-readable title derived from it.
      const searchTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");

      // ── 1. Hydrate from the session cache ──────────────────────────────────
      // Back-navigation from the reader remounts this component, so without a
      // cache every back-nav was a full cold load (and an AniList 429 waiting
      // to happen, which is what left the cover blank). A cache hit paints
      // instantly and the network refresh happens underneath it.
      const cached = readDetail(titleSlug);
      let currentManga = null;
      let currentChapters = [];
      let currentSourceId = cached?.sourceId || "";
      let currentSourceUrl = cached?.sourceUrl || "";
      if (cached && cached.manga) {
        currentManga = cached.manga;
        currentChapters = cached.chapters || [];
        setManga(currentManga);
        setMangaId(cached.mangaId || "");
        setChapters(currentChapters);
        setSourceId(cached.sourceId || "");
        setSourceUrl(cached.sourceUrl || "");
        setLoading(false);
        setCoverAlt(readCover(titleSlug));
        if (isFresh(cached)) return; // recent enough — no revalidation needed
      } else {
        setLoading(true);
      }

      // Restore cached cover from this session so a slow or rate-limited
      // AniList response never leaves the cover blank.
      const cachedCover = readCover(titleSlug);
      if (cachedCover) seedCover(titleSlug, cachedCover);
      if (queryCover) seedCover(titleSlug, queryCover);

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
          if (resolvedId && !resolvedId.startsWith("mal-")) {
            try {
              const cleanId = resolvedId.startsWith("anilist-") 
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
        }

        if (media) {
          const aniTitle = media.title.english || media.title.romaji || media.title.userPreferred;
          normalizedManga = {
            id: String(media.id),
            title: aniTitle,
            cover: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || cachedCover || queryCover || "",
            description: media.description || "No description available.",
            status: media.status === "RELEASING" ? "RELEASING" : "FINISHED",
            rating: media.averageScore ? media.averageScore / 20 : 4.5,
            genres: media.genres || [],
            year: media.startDate?.year || "Unknown",
            popularity: media.popularity || 0,
          };
          resolvedId = String(media.id);
          // Cache the cover so it survives navigation back from the reader
          if (typeof window !== "undefined" && normalizedManga.cover) {
            writeCover(titleSlug, normalizedManga.cover);
            coverCacheRef.current.set(titleSlug, normalizedManga.cover);
          }
        } else if (resolvedId) {
          // We matched from getMangaList but couldn't get full details — use the search result data
          const matchData = searchRes?.media?.find(m => m.id === resolvedId);
          if (matchData) {
            normalizedManga = {
              id: resolvedId,
              title: matchData.t,
              cover: matchData.cover || cachedCover || "",
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
          
          normalizedManga = {
            id: `fallback-${slugify(searchTitle)}`,
            title: searchTitle,
            cover: cachedCover || queryCover,
            description: "Detailed description is not available in our database. You can still read the chapters below.",
            status: "RELEASING",
            rating: 4.5,
            genres: ["Ongoing"],
            year: "Unknown",
            popularity: 0,
          };
          resolvedId = normalizedManga.id;
        }

        if (cancelled) return;

        currentManga = normalizedManga;
        setManga(currentManga);
        setMangaId(resolvedId);
        setLoading(false);

        if (queryCover && !redirectDoneRef.current) {
          redirectDoneRef.current = true;
          router.replace(`/manga/${titleSlug}`);
        }

        // One view write per slug per session — previously every back-nav
        // from the reader added another Postgres write.
        if (typeof window !== 'undefined' && markViewedOnce(titleSlug)) {
          fetch(`${apiBase}/api/manga/track-view?slug=${encodeURIComponent(titleSlug)}&title=${encodeURIComponent(normalizedManga.title)}&chapterCount=0`, {
            method: 'GET',
            keepalive: true,
          }).catch(() => {});
        }

        // 2. Fetch chapters from backend API (client-side CORS fetching removed
        //    because source sites block cross-origin requests and public CORS
        //    proxies are unreliable).
        //    Only show the chapter spinner when we have nothing cached to show.
        const hadCachedChapters = (cached?.chapters?.length || 0) > 0;
        if (!hadCachedChapters) setLoadingChapters(true);
        let chaptersLoaded = false;
        const prefSource = typeof window !== "undefined" ? localStorage.getItem(`preferred_source_${resolvedId}`) : null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          const mapRes = await fetch(prefSource ? `${apiBase}/api/manga/source-chapters?title=${encodeURIComponent(normalizedManga.title)}&source=${prefSource}` : `${apiBase}/api/manga/map?title=${encodeURIComponent(normalizedManga.title)}&mangaId=${encodeURIComponent(resolvedId)}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            if (mapData.data && mapData.data.chapters?.length > 0) {
              currentChapters = mapData.data.chapters || [];
              currentSourceId = mapData.data.sourceId || "";
              currentSourceUrl = mapData.data.url || "";
              setChapters(currentChapters);
              setSourceId(currentSourceId);
              setSourceUrl(currentSourceUrl);
              // Only fill gaps — never overwrite an existing cover. The old
              // `!manga || !manga.cover` read `manga` from the effect closure,
              // which is always null on mount, so the source-site cover
              // clobbered the working AniList cover on every back-nav. Those
              // covers 403 through the image proxy often enough that the cover
              // ended up blank.
              const patch = {};
              if (mapData.data.cover && !currentManga.cover) patch.cover = mapData.data.cover;
              if (mapData.data.title && !currentManga.description) {
                patch.title = mapData.data.title;
                patch.description = mapData.data.description || currentManga.description;
              }
              if (Object.keys(patch).length) {
                currentManga = { ...currentManga, ...patch };
                setManga(currentManga);
              }
              chaptersLoaded = true;
              if (mapData.data.sourceId) {
                localStorage.setItem(`preferred_source_${resolvedId}`, mapData.data.sourceId);
              }
            }
          }
        } catch (mapErr) {
          console.warn("Backend chapter fetch failed:", mapErr.message);
        }

        setLoadingChapters(false);

        // Persist the resolved payload so the next visit (especially the
        // back-navigation from the reader) paints instantly.
        if (!cancelled && currentManga) {
          writeDetail(titleSlug, {
            manga: currentManga,
            mangaId: resolvedId,
            chapters: currentChapters,
            sourceId: currentSourceId,
            sourceUrl: currentSourceUrl,
          });
        }

      } catch (err) {
        console.error("Failed to load manga details:", err.message);
        setLoading(false);
      }
    }

    if (titleSlug) {
      loadMangaDetail();
    }
    return () => { cancelled = true; };
  }, [titleSlug]);

  const handleSourceChange = async (newSourceId) => {
    localStorage.setItem(`preferred_source_${mangaId}`, newSourceId);
    if (!manga) return;
    setLoadingChapters(true);
    setChPage(1);
    let loaded = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${apiBase}/api/manga/source-chapters?title=${encodeURIComponent(manga.title)}&source=${newSourceId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setChapters(data.data.chapters || []);
          setSourceId(data.data.sourceId || "");
          setSourceUrl(data.data.url || "");
          if (data.data.cover) {
            setManga(prev => prev ? { ...prev, cover: data.data.cover } : prev);
          }
          if (data.data.title) {
            setManga(prev => prev ? { ...prev, title: data.data.title, description: data.data.description || prev.description, status: prev?.status, genres: prev?.genres } : prev);
          }
          loaded = true;
        }
      }
    } catch (err) {
      console.warn("Backend source switch failed:", err.message);
    }

    if (!loaded) {
      setChapters([]);
      setSourceId(newSourceId);
      setSourceUrl("");
    }

    setLoadingChapters(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0, 0, 0, 0)", border: 0 }}>
          {decodeURIComponent(titleSlug).replace(/-/g, " ")}
        </h1>
        <Loader />
      </div>
    );
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
    addToHistory(manga.title, ch.title || `Chapter ${chNum}`, chNum, ch.href, sourceId, mangaId, manga.cover);
    preloadOfflineChapter(mangaId, chNum, manga.title);
    router.push(`/reader/${chNum}?url=${encodeURIComponent(ch.href || "")}&source=${sourceId}&title=${encodeURIComponent(manga.title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(manga.cover || "")}`);
  };

  const handleDownloadChapterClick = async (ch, idx) => {
    const chNum = totalChapters - idx;
    const chTitle = ch.title || `Chapter ${chNum}`;
    
    // 1. Show the inline progress loader on the chapter row
    setDownloadingChapters((prev) => ({ ...prev, [chNum]: 5 }));
    // 2. Open the Rewarded Ad Modal showing the live sponsor ad, countdown, and progress
    setDownloadTarget({ chNum, title: chTitle, href: ch.href });
    setDownloadProgress({ percent: 5, text: `Connecting to server for Chapter ${chNum}...` });
    setDownloadModalOpen(true);

    try {
      // 1. Fetch images in background right here on the manga page
      const res = await fetchChapterImagesThroughWorker(ch.href, sourceId);
      const images = res?.data?.images || [];
      if (!images || images.length === 0) {
        throw new Error('No pages found for this chapter');
      }

      setDownloadingChapters((prev) => ({ ...prev, [chNum]: 15 }));
      setDownloadProgress({ percent: 15, text: `Pre-caching ${images.length} pages for offline reading...` });

      // 2. Pre-cache all page images into persistent IndexedDB (in-browser offline storage)
      await makeChapterAvailableOffline({
        images,
        mangaTitle: manga?.title || 'Manga',
        chapterNum: chNum,
        chapterTitle: `${manga?.title || 'Manga'} - ${chTitle}`,
        cover: manga?.cover || primaryCover,
        mangaId,
        onProgress: (percent, text) => {
          setDownloadingChapters((prev) => ({ ...prev, [chNum]: percent }));
          setDownloadProgress({ percent, text });
        },
      });

      // Synchronously mark offline before clearing downloadingChapters to eliminate any UI flicker
      setOfflineChapters((prev) => new Set([...prev, chNum]));
      setDownloadProgress({ percent: 100, text: `Chapter ${chNum} ready offline for 24 hours! ⚡` });
      toast.success(`Chapter ${chNum} saved offline for 24 hours! ⚡`);
    } catch (err) {
      console.warn('In-place offline save error:', err);
      toast.error(`Save failed: ${err.message || 'Network error'}`);
    } finally {
      setDownloadingChapters((prev) => {
        const next = { ...prev };
        delete next[chNum];
        return next;
      });
    }
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

  const applyBulkDownload = async () => {
    if (selected.size === 0) return;
    const selectedNums = [...selected].sort((a, b) => a - b);
    const totalCount = selectedNums.length;
    clearSelection();

    const rangeLabel = totalCount === 1 
      ? `Chapter ${selectedNums[0]}`
      : `Chapters ${selectedNums[0]} - ${selectedNums[selectedNums.length - 1]}`;

    setDownloadTarget({
      chNum: selectedNums[0],
      title: `${totalCount} Chapters (${rangeLabel})`,
      href: '',
    });
    setDownloadModalOpen(true);
    setDownloadProgress({
      percent: 5,
      text: `Preparing to save ${totalCount} chapters offline...`,
    });

    setDownloadingChapters((prev) => {
      const next = { ...prev };
      selectedNums.forEach((num) => {
        next[num] = 0;
      });
      return next;
    });

    try {
      for (let i = 0; i < totalCount; i++) {
        const chNum = selectedNums[i];
        const chIdx = chapters.findIndex((_, idx) => totalChapters - idx === chNum);
        if (chIdx === -1) continue;
        const ch = chapters[chIdx];
        const chTitle = ch.title || `Chapter ${chNum}`;

        const basePercent = Math.round((i / totalCount) * 90);
        setDownloadProgress({
          percent: basePercent + 2,
          text: `Fetching Ch ${chNum} (${i + 1}/${totalCount})...`,
        });
        setDownloadingChapters((prev) => ({ ...prev, [chNum]: 5 }));

        // 1. Fetch images for this chapter
        const res = await fetchChapterImagesThroughWorker(ch.href, sourceId);
        const images = res?.data?.images || [];
        if (!images || images.length === 0) {
          console.warn(`No pages found for chapter ${chNum}`);
          setDownloadingChapters((prev) => {
            const next = { ...prev };
            delete next[chNum];
            return next;
          });
          continue;
        }

        // 2. Pre-cache all images for this chapter
        await makeChapterAvailableOffline({
          images,
          mangaTitle: manga?.title || 'Manga',
          chapterNum: chNum,
          chapterTitle: `${manga?.title || 'Manga'} - ${chTitle}`,
          cover: manga?.cover || primaryCover,
          mangaId,
          onProgress: (chPct, chTxt) => {
            const stepPercent = Math.min(95, Math.round(basePercent + (chPct / 100) * (90 / totalCount)));
            setDownloadProgress({
              percent: stepPercent,
              text: `Ch ${chNum} (${i + 1}/${totalCount}): ${chTxt}`,
            });
            setDownloadingChapters((prev) => ({ ...prev, [chNum]: chPct }));
          },
        });

        setDownloadingChapters((prev) => {
          const next = { ...prev };
          delete next[chNum];
          return next;
        });
        setOfflineChapters((prev) => new Set(prev).add(chNum));
      }

      setDownloadProgress({
        percent: 100,
        text: `All ${totalCount} chapters are now available offline! ⚡`,
      });
      toast.success(`${totalCount} continuous chapters saved offline!`);
    } catch (err) {
      console.warn('Bulk offline caching error:', err);
      toast.error(`Offline save error: ${err.message || 'Network error'}`);
    } finally {
      setDownloadingChapters({});
    }
  };

  const applyBulkRemoveOffline = async () => {
    const nums = Array.from(selected).filter(
      (n) => offlineChapters.has(n) || offlineChapters.has(Number(n)) || offlineChapters.has(String(n))
    );
    if (!nums.length) return;
    setOfflineChapters((prev) => {
      const next = new Set(prev);
      nums.forEach((n) => {
        next.delete(n);
        next.delete(Number(n));
        next.delete(String(n));
      });
      return next;
    });
    clearSelection();
    for (const n of nums) {
      await deleteOfflineChapter(mangaId, n, manga?.title || titleSlug);
    }
    toast.success(`Removed ${nums.length} chapters from offline storage`);
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

  const isNSFWItem = isExplicitNSFW(manga?.genres || [], manga?.title || "", { isAdult: manga?.isAdult });
  const shouldBlur = isNSFWItem && !isNSFW;

  return (
    <div>
      {/* MANGA HERO INFOS */}
      <div className="detail-hero">
        <div 
          className="detail-cover"
          style={
            primaryCover
              ? { position: "relative", overflow: "hidden" }
              : {}
          }
        >
          {primaryCover ? (
            <Image
              key={primaryCover}
              src={proxyImage(primaryCover, 200)}
              alt={`Cover for ${manga.title}`}
              fill
              sizes="(max-width: 768px) 110px, (max-width: 900px) 140px, 195px"
              style={{ 
                objectFit: "cover", 
                objectPosition: "center",
                filter: shouldBlur ? "blur(40px) brightness(0.3)" : "none",
                transition: "filter 0.3s ease"
              }}
              priority
              fetchPriority="high"
              onError={() => setCoverIndex((i) => i + 1)}
            />
          ) : (
            <div style={{
              position: "absolute",
              inset: 0,
              background: COVER_GRADS[0],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--serif)",
              fontSize: "18px",
              color: "rgba(232, 222, 255, .4)",
              textAlign: "center",
              padding: "8px",
            }}>
              {abbr(manga.title)}
            </div>
          )}
          {shouldBlur && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              textAlign: "center",
              padding: "16px",
              fontFamily: "var(--sans)",
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: 1.4,
              pointerEvents: "none"
            }}>
              <div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto 8px auto", display: "block" }}>
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                May contain<br/>explicit content
              </div>
            </div>
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
                <button
                  className="btn btn-s"
                  onClick={() => {
                    const continueChNum = highestRead > 0 ? Math.min(highestRead, totalChapters) : 1;
                    const continueIdx = totalChapters - continueChNum;
                    handleDownloadChapterClick(chapters[continueIdx], continueIdx);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                  aria-label="Download Chapter (.cbz)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download CBZ</span>
                </button>
              </>
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text3)", padding: "4px 0" }}>
                {loadingChapters ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="spinner" style={{ width: "14px", height: "14px", border: "2px solid var(--text3)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }}></span>
                    Searching selected source...
                  </span>
                ) : (
                  <span>
                    No chapters found on this server. Try switching to another server above.
                  </span>
                )}
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

        <div className="detail-note-wrapper">
          <MangaNote mangaId={mangaId} />
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
                <button
                  className="ch-bulk-btn"
                  disabled={selected.size === 0}
                  onClick={applyBulkDownload}
                  title="Make all selected chapters available offline"
                  style={{ background: selected.size > 0 ? "rgba(168, 85, 247, 0.2)" : undefined, color: selected.size > 0 ? "#c084fc" : undefined }}
                >
                  ⚡ Save Offline ({selected.size})
                </button>
                {Array.from(selected).some(
                  (n) => offlineChapters.has(n) || offlineChapters.has(Number(n)) || offlineChapters.has(String(n))
                ) && (
                  <button
                    className="ch-bulk-btn"
                    onClick={applyBulkRemoveOffline}
                    title="Remove selected chapters from offline storage"
                    style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}
                  >
                    ✕ Remove Offline
                  </button>
                )}
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
                          {downloadingChapters[chNum] !== undefined ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "rgba(168, 85, 247, 0.18)",
                                border: "1px solid rgba(168, 85, 247, 0.45)",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#d8b4fe",
                                flexShrink: 0,
                                boxShadow: "0 0 10px rgba(168, 85, 247, 0.2)",
                              }}
                              title={`Downloading Chapter ${chNum} for offline reading: ${downloadingChapters[chNum]}%`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg
                                style={{ animation: "spin 0.8s linear infinite", width: "11px", height: "11px", flexShrink: 0 }}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                              </svg>
                              <span>{downloadingChapters[chNum]}%</span>
                            </div>
                          ) : (offlineChapters.has(chNum) || offlineChapters.has(Number(chNum)) || offlineChapters.has(String(chNum))) ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  background: "rgba(34, 197, 94, 0.15)",
                                  color: "#4ade80",
                                  border: "1px solid rgba(34, 197, 94, 0.3)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "2px",
                                  whiteSpace: "nowrap",
                                }}
                                title="Saved offline for 24 hours (0 data used). Tap ✕ to remove."
                              >
                                ⚡<span className="ch-offline-label"> 24h</span>
                              </span>
                              <button
                                className="ch-play"
                                style={{
                                  cursor: "pointer",
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#f87171",
                                  border: "none",
                                  fontSize: "10px",
                                  width: "22px",
                                  height: "22px",
                                  flexShrink: 0,
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setOfflineChapters((prev) => {
                                    const next = new Set(prev);
                                    next.delete(chNum);
                                    next.delete(Number(chNum));
                                    next.delete(String(chNum));
                                    return next;
                                  });
                                  try {
                                    await deleteOfflineChapter(mangaId, chNum, manga?.title || titleSlug);
                                    toast.success(`Removed Chapter ${chNum} from offline storage`);
                                  } catch (err) {
                                    console.warn("Delete offline chapter error:", err);
                                  }
                                }}
                                title={`Delete offline cache for chapter ${chNum}`}
                                aria-label={`Delete offline cache for chapter ${chNum}`}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              className="ch-play"
                              style={{ cursor: "pointer", background: "rgba(255, 255, 255, 0.08)", width: "24px", height: "24px", flexShrink: 0 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadChapterClick(c, chIndex);
                              }}
                              title={`Save Chapter ${chNum} for 24 hours of offline reading`}
                              aria-label={`Save chapter ${chNum} for 24 hours of offline reading`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          )}
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
                aria-label="Previous page"
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
                aria-label="Next page"
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
          <CommentSection mangaId={mangaId} active={activeTab === 'discussion'} />
        </div>
      </div>

      {/* In-place Rewarded Ad & Download Modal */}
      <RewardedAdModal
        isOpen={downloadModalOpen}
        onClose={() => {
          setDownloadModalOpen(false);
          setDownloadTarget(null);
          setDownloadProgress(null);
        }}
        onReward={() => {}}
        chapterTitle={downloadTarget ? `${manga?.title || ''} - ${downloadTarget.title}` : 'Downloading Chapter'}
        packProgress={downloadProgress}
      />

      <Footer />
    </div>
  );
}
