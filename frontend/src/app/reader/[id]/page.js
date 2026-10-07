"use client";

import React, { Fragment, use, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import Loader from "@/components/Loader";
import { useApp } from "@/context/AppContext";
import Image from "next/image";
import { API_BASE, proxyImage, fetchChapterImagesThroughWorker } from "@/utils/api";
import { useDrag } from "@use-gesture/react";
import dynamic from "next/dynamic";
import AAdsInline from "@/components/AAdsInline";
import RewardedAdModal from "@/components/RewardedAdModal";
import { 
  getOfflineChapter, 
  makeChapterAvailableOffline, 
  isChapterOffline, 
  getOfflineChaptersForManga, 
  getMemoryOfflineChapter, 
  preloadOfflineChapter 
} from "@/utils/offlineStorage";
import { HILLTOP_DIRECT_LINK } from "@/lib/site-config";

const AAdsBanner = dynamic(() => import("@/components/AAdsBanner"), { ssr: false });

/**
 * Exactly one 300x250 slot per chapter, after the 3rd page image:
 *
 *   page 1 / page 2 / page 3 / [ad] / page 4 ... rest of the chapter
 *
 * One is deliberate. The sticky 728x90 A-ADS banner already runs at the bottom
 * of every reader, so a second inline unit repeating every few pages would make
 * two ad slots per screenful on long chapters — that reads as a wall of ads,
 * and readers bounce. Two ad moments per chapter is the budget:
 * one mid-chapter, one at the bottom.
 *
 * Skipped on short chapters where the 3rd page is the last one — a slot with
 * nothing after it reads as an end-of-chapter banner, not an inline unit.
 *
 * Webtoon mode only. Paged mode renders one 100vh page at a time, so a block
 * there would push the artwork down instead of separating two pages.
 */
const AD_AFTER_PAGE = 3;

function ReaderContent({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);
  const { addToHistory, markChapterRead } = useApp();

  const url = searchParams.get("url") || "";
  const source = searchParams.get("source") || "";
  const title = searchParams.get("title") || "";
  const mangaId = searchParams.get("mangaId") || "";
  const cover = searchParams.get("cover") || "";

  const isNotChapterImage = (img) => typeof img === 'string' && (
    /[_-]\d{2,4}x\d{2,4}\.(?:jpg|jpeg|png|webp|avif)/i.test(img) ||
    /\b(?:avatar|logo|banner|icon|thumb)\b/i.test(img) ||
    img.startsWith('data:text/html') ||
    img.startsWith('data:application/')
  );
  const sanitizeChapterImages = (list) => Array.isArray(list) ? list.filter(img => typeof img === 'string' && !isNotChapterImage(img)) : [];

  // Instant synchronous memory lookup to eliminate any flash of loading spinner
  const initialMem = typeof window !== 'undefined' ? getMemoryOfflineChapter(mangaId, id, title) : null;
  const initialImages = sanitizeChapterImages(initialMem?.images);

  const [currentId, setCurrentId] = useState(id);
  const [images, setImages] = useState(initialImages);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(() => initialImages.length === 0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [brightnessPop, setBrightnessPop] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [imgRetries, setImgRetries] = useState({});
  const [viewMode, setViewMode] = useState("webtoon");
  const [showNav, setShowNav] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [showRewardedModal, setShowRewardedModal] = useState(false);
  const [packProgress, setPackProgress] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => initialImages.length > 0);
  const [savedOfflineChapters, setSavedOfflineChapters] = useState(() => new Set());
  const [loadedImages, setLoadedImages] = useState({});
  const hasTriggeredAutoDownloadRef = useRef(false);
  const autoDownload = searchParams.get("download") === "1";

  // Sync state synchronously during render when navigating across chapters
  if (currentId !== id) {
    setCurrentId(id);
    const mem = typeof window !== 'undefined' ? getMemoryOfflineChapter(mangaId, id, title) : null;
    const cleanMem = sanitizeChapterImages(mem?.images);
    if (cleanMem.length) {
      setImages(cleanMem);
      setIsOfflineMode(true);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  const handleStartDownload = async () => {
    if (!images || images.length === 0) return;
    setShowRewardedModal(true);
    setPackProgress({ percent: 5, text: `Pre-caching Chapter ${id} for offline reading...` });

    try {
      await makeChapterAvailableOffline({
        images,
        mangaTitle: title || 'Manga',
        chapterNum: id,
        chapterTitle: title ? `${title} - Chapter ${id}` : `Chapter ${id}`,
        cover,
        mangaId,
        onProgress: (percent, text) => {
          setPackProgress({ percent, text });
        },
      });
      setIsOfflineMode(true);
    } catch (err) {
      console.warn('Offline caching error in reader:', err);
    }
  };

  const readerPagesRef = useRef(null);
  const endRef = useRef(null);
  const brightnessTimerRef = useRef(null);
  const isNavigatingRef = useRef(false);

  const resetBrightnessTimer = () => {
    if (brightnessTimerRef.current) {
      clearTimeout(brightnessTimerRef.current);
    }
    brightnessTimerRef.current = setTimeout(() => {
      setBrightnessPop(false);
    }, 3000);
  };

  useEffect(() => {
    if (brightnessPop) {
      resetBrightnessTimer();
    }
    return () => {
      if (brightnessTimerRef.current) {
        clearTimeout(brightnessTimerRef.current);
      }
    };
  }, [brightnessPop, brightness]);

  // Reset navigation guard, scroll to top, and clear transient state on chapter change
  useEffect(() => {
    isNavigatingRef.current = false;
    window.scrollTo({ top: 0, behavior: "instant" });
    setPage(1);
    setImgErrors({});
    setLoadedImages({});
  }, [id]);

  // Fetch chapters list on mount
  useEffect(() => {
    if (title) {
      const fetchUrl = source
        ? `${API_BASE}/api/manga/source-chapters?title=${encodeURIComponent(title)}&source=${source}`
        : `${API_BASE}/api/manga/map?title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}`;

      fetch(fetchUrl)
        .then((res) => res.json())
        .then((res) => {
          if (res.data && res.data.chapters) {
            setChapters(res.data.chapters);
          }
        })
        .catch((err) => console.warn("Failed to fetch chapters in reader:", err.message));
    }
  }, [title, mangaId, source]);

  // Sync offline chapters from IndexedDB so continuous offline reading works seamlessly
  useEffect(() => {
    if (!mangaId && !title) return;
    const syncOffline = () => {
      getOfflineChaptersForManga(mangaId, title).then((offlineList) => {
        if (offlineList && offlineList.length > 0) {
          const nums = new Set(offlineList.map((c) => Number(c.chapterNum) || c.chapterNum));
          setSavedOfflineChapters(nums);
          // Preload adjacent offline chapters for continuous 0ms reading
          const currentNum = parseInt(id) || 1;
          preloadOfflineChapter(mangaId, currentNum + 1, title);
          if (currentNum > 1) {
            preloadOfflineChapter(mangaId, currentNum - 1, title);
          }
          // If chapters list from network failed/offline, seed with offline chapters
          setChapters((prev) => {
            if (prev && prev.length > 0) return prev;
            return offlineList
              .map((c) => ({
                title: c.chapterTitle || `Chapter ${c.chapterNum}`,
                href: '',
                chNum: Number(c.chapterNum) || c.chapterNum,
              }))
              .sort((a, b) => b.chNum - a.chNum);
          });
        } else {
          setSavedOfflineChapters(new Set());
        }
      });
    };
    syncOffline();
    window.addEventListener('offline-chapters-updated', syncOffline);
    return () => window.removeEventListener('offline-chapters-updated', syncOffline);
  }, [mangaId, title, id]);

  // Fetch chapter images
  useEffect(() => {
    const mem = getMemoryOfflineChapter(mangaId, id, title);
    const cleanMem = sanitizeChapterImages(mem?.images);
    if (cleanMem.length) {
      setImages(cleanMem);
      setIsOfflineMode(true);
      setLoading(false);
      addToHistory(
        title || mem.mangaTitle || "Manga",
        `Chapter ${id}`,
        parseInt(id) || 1,
        url || '',
        source || '',
        mangaId || mem.mangaId,
        cover || mem.cover || ''
      );
      return;
    }

    setLoading(true);
    setError(null);

    const fetchImages = async () => {
      try {
        // 1. Instant load from offline IndexedDB if downloaded (works offline without network or url)
        if (id) {
          try {
            const offlineChapter = await getOfflineChapter(mangaId, id, title);
            const validImages = sanitizeChapterImages(offlineChapter?.images);
            if (validImages.length > 0) {
              setImages(validImages);
              setIsOfflineMode(true);
              setLoading(false);
                addToHistory(
                  title || offlineChapter.mangaTitle || "Manga",
                  `Chapter ${id}`,
                  parseInt(id) || 1,
                  url || '',
                  source || '',
                  mangaId || offlineChapter.mangaId,
                  cover || offlineChapter.cover || ''
                );
                return;
            }
          } catch (e) {
            console.warn("Offline DB check error:", e);
          }
        }
        setIsOfflineMode(false);

        if (!url) {
          setError("No chapter URL provided.");
          setLoading(false);
          return;
        }

        const res = await fetchChapterImagesThroughWorker(url, source);
        if (res?.data?.images && res.data.images.length > 0) {
          setImages(res.data.images);
          setLoading(false);
          addToHistory(title || "Manga", `Chapter ${id}`, parseInt(id) || 1, url, source, mangaId, cover);
        } else {
          throw new Error("No images found in server response");
        }
      } catch (err) {
        console.warn("Reader fetch error, falling back to mock panels:", err.message);

        const mockPages = Array.from({ length: 6 }).map((_, idx) => {
          const pageNum = idx + 1;
          const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
              <rect width="800" height="1200" fill="#0d0714"/>
              <rect x="40" y="40" width="720" height="340" fill="#180e25" rx="8" stroke="#331c4e" stroke-width="2"/>
              <rect x="40" y="400" width="345" height="360" fill="#180e25" rx="8" stroke="#331c4e" stroke-width="2"/>
              <rect x="415" y="400" width="345" height="360" fill="#180e25" rx="8" stroke="#331c4e" stroke-width="2"/>
              <rect x="40" y="780" width="720" height="380" fill="#180e25" rx="8" stroke="#331c4e" stroke-width="2"/>
              <text x="400" y="220" font-family="system-ui, sans-serif" font-size="32" fill="#a855f7" text-anchor="middle" font-weight="bold" letter-spacing="2">MANGA READER</text>
              <text x="400" y="600" font-family="system-ui, sans-serif" font-size="24" fill="#e8def8" text-anchor="middle" font-weight="500">PAGE ${pageNum}</text>
              <text x="400" y="980" font-family="system-ui, sans-serif" font-size="16" fill="#7d6a91" text-anchor="middle">Demo Sandbox panel layout</text>
            </svg>
          `;
          return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
        });

        setImages(mockPages);
        setLoading(false);
      }
    };

    fetchImages();
  }, [url, source, id, title, mangaId]);

  // Preload adjacent offline chapters into memory cache so next/prev clicks transition in 0ms
  useEffect(() => {
    const curNum = parseInt(id) || 1;
    const nextNum = curNum + 1;
    const prevNum = curNum - 1;
    if (savedOfflineChapters.has(nextNum)) {
      preloadOfflineChapter(mangaId, nextNum, title);
    }
    if (prevNum >= 1 && savedOfflineChapters.has(prevNum)) {
      preloadOfflineChapter(mangaId, prevNum, title);
    }
  }, [id, mangaId, title, savedOfflineChapters]);

  // Trigger download modal if navigated with ?download=1
  useEffect(() => {
    if (autoDownload && images.length > 0 && !hasTriggeredAutoDownloadRef.current) {
      hasTriggeredAutoDownloadRef.current = true;
      handleStartDownload();
    }
  }, [autoDownload, images]);

  // Page tracking via IntersectionObserver — accurate per image detection
  const observerRef = useRef(null);

  useEffect(() => {
    const el = readerPagesRef.current;
    if (!el || images.length === 0) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const pageEls = el.querySelectorAll(".reader-page");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Array.from(pageEls).indexOf(entry.target);
            if (idx >= 0) {
              setPage(idx + 1);
              if (idx + 1 === images.length && mangaId) {
                markChapterRead(mangaId, parseInt(id) || 1);
              }
            }
          }
        });
      },
      { root: null, rootMargin: "-50% 0px", threshold: 0 }
    );
    // Also observe the end element for marking read and showing nav automatically
    const endObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (mangaId) markChapterRead(mangaId, parseInt(id) || 1);
          setShowNav(true);
        }
      },
      { rootMargin: "0px", threshold: 0 }
    );
    if (endRef.current) endObserver.observe(endRef.current);

    pageEls.forEach((pg) => observer.observe(pg));
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      endObserver.disconnect();
    };
  }, [images, mangaId, id, markChapterRead]);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollBot = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const goToNextChapter = async () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    const currentChNum = parseInt(id) || 1;
    let targetNextNum = currentChNum + 1;
    let nextHref = "";

    // 1. Try to find the next chapter in the chapters array
    const directMatch = chapters.find((c) => Number(c.chNum) === targetNextNum);
    if (directMatch) {
      nextHref = directMatch.href || "";
    } else {
      let currentIdx = chapters.findIndex((c) => (c.href && c.href === url) || Number(c.chNum) === currentChNum);
      if (currentIdx === -1 && id) {
        currentIdx = chapters.length - currentChNum;
      }
      if (currentIdx > 0 && chapters[currentIdx - 1]) {
        nextHref = chapters[currentIdx - 1].href || "";
        if (chapters[currentIdx - 1].chNum) {
          targetNextNum = Number(chapters[currentIdx - 1].chNum);
        }
      }
    }

    const nextIsOffline = await isChapterOffline(mangaId, targetNextNum, title);
    if (nextHref || nextIsOffline || savedOfflineChapters.has(targetNextNum) || (chapters.length > 0 && targetNextNum <= chapters.length)) {
      router.push(`/reader/${targetNextNum}?url=${encodeURIComponent(nextHref)}&source=${source}&title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(cover)}`);
    } else {
      isNavigatingRef.current = false;
    }
  };

  const goToPrevChapter = async () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    const currentChNum = parseInt(id) || 1;
    let targetPrevNum = currentChNum - 1;

    if (targetPrevNum < 1) {
      router.push(`/manga/${encodeURIComponent(title)}`);
      return;
    }

    let prevHref = "";
    const directMatch = chapters.find((c) => Number(c.chNum) === targetPrevNum);
    if (directMatch) {
      prevHref = directMatch.href || "";
    } else {
      let currentIdx = chapters.findIndex((c) => (c.href && c.href === url) || Number(c.chNum) === currentChNum);
      if (currentIdx === -1 && id) {
        currentIdx = chapters.length - currentChNum;
      }
      if (currentIdx < chapters.length - 1 && currentIdx !== -1 && chapters[currentIdx + 1]) {
        prevHref = chapters[currentIdx + 1].href || "";
        if (chapters[currentIdx + 1].chNum) {
          targetPrevNum = Number(chapters[currentIdx + 1].chNum);
        }
      }
    }

    const prevIsOffline = await isChapterOffline(mangaId, targetPrevNum, title);
    if (prevHref || prevIsOffline || savedOfflineChapters.has(targetPrevNum)) {
      router.push(`/reader/${targetPrevNum}?url=${encodeURIComponent(prevHref)}&source=${source}&title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(cover)}`);
    } else {
      router.push(`/manga/${encodeURIComponent(title)}`);
    }
  };

  const TOTAL_PAGES = images.length;
  const mappedChapters = chapters.map((c, index) => ({ ...c, originalIndex: index, chNum: chapters.length - index }));

  const handleChapterSelect = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const ch = chapters[selectedIndex];
    if (ch) {
      const chNum = chapters.length - selectedIndex;
      router.push(`/reader/${chNum}?url=${encodeURIComponent(ch.href || "")}&source=${source}&title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(cover)}`);
    }
  };

  const handleKeyDown = (e) => {
    if (brightnessPop) return;
    switch (e.key) {
      case "ArrowRight": {
        e.preventDefault();
        goToNextChapter();
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        goToPrevChapter();
        break;
      }
      case "Home":
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "End":
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        break;
      case "Escape":
        e.preventDefault();
        setBrightnessPop(false);
        break;
      default:
        break;
    }
  };

  const bindSwipe = useDrag(({ swipe: [swipeX] }) => {
    if (swipeX === -1) {
      // Swipe left
      if (viewMode === "paged" && page < TOTAL_PAGES) {
        setPage(p => p + 1);
      } else {
        goToNextChapter();
      }
    } else if (swipeX === 1) {
      // Swipe right
      if (viewMode === "paged" && page > 1) {
        setPage(p => p - 1);
      } else {
        goToPrevChapter();
      }
    }
  });

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px", color: "#fff", background: "#000" }}>
        <h2>Error Loading Chapter</h2>
        <p style={{ marginTop: "12px", color: "var(--red)" }}>{error}</p>
        <button className="btn btn-p" style={{ marginTop: "20px" }} onClick={() => router.back()}>
          Go Back
        </button>
      </div>
    );
  }

  const handleReaderClick = (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('.brightness-slider') || e.target.closest('.brightness-pop')) return;
    setShowNav(!showNav);
  };

  return (
    <div role="region" aria-label="Manga reader" onKeyDown={handleKeyDown} tabIndex={0} {...bindSwipe()} style={{ touchAction: zoomedImage !== null ? "pan-x pan-y" : "pan-y" }}>
      <div className="reader-wrap" style={{ background: "#000" }} onClick={handleReaderClick}>
        {/* Top Toolbar */}
        {showNav && (
          <div className="reader-toolbar">
            <button className="rt-btn" onClick={() => router.back()} aria-label="Go back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="rt-btn-text">Back</span>
            </button>
            <button className="rt-btn rt-desktop-only" onClick={() => router.push("/")} aria-label="Go to home">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12L12 3l9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path
                  d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="rt-btn rt-desktop-only" onClick={() => window.location.reload()} aria-label="Reload chapter">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5M4.93 19.07A10 10 0 102.12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="rt-sep"></div>
            {chapters.length > 0 ? (
              <select
                className="rt-ch-select"
                value={(() => {
                  const idx = chapters.findIndex(ch => ch.href === url);
                  if (idx !== -1) return idx;
                  if (id) return chapters.length - parseInt(id);
                  return 0;
                })()}
                onChange={handleChapterSelect}
                aria-expanded="false"
                aria-label="Select chapter"
              >
                {chapters.map((ch, idx) => {
                  const chNumber = ch.chNum ?? (chapters.length - idx);
                  const isOff = savedOfflineChapters.has(Number(chNumber));
                  return (
                    <option key={idx} value={idx} style={{ background: "#180e25", color: "#fff" }}>
                      {isOff ? '⚡ ' : ''}{ch.title || `Chapter ${chNumber}`}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="rt-ch-title" style={{ fontSize: "13px", color: "#fff", fontWeight: "600", flexShrink: 0 }}>
                Chapter {id}
              </span>
            )}

            <div className="rt-sep"></div>
            <span className="rt-page-info">
              {page}/{TOTAL_PAGES}
            </span>

            <div className="rt-sep"></div>
            <button
              className="rt-btn"
              onClick={goToPrevChapter}
              aria-label="Previous chapter"
              disabled={parseInt(id) <= 1 || (!mappedChapters.some(c => c.chNum === parseInt(id) - 1) && !savedOfflineChapters.has(parseInt(id) - 1))}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="rt-btn"
              onClick={goToNextChapter}
              aria-label="Next chapter"
              disabled={!mappedChapters.some(c => c.chNum === parseInt(id) + 1) && !savedOfflineChapters.has(parseInt(id) + 1)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="rt-sep"></div>
            {isOfflineMode || savedOfflineChapters.has(parseInt(id)) ? (
              <span
                className="rt-offline-badge"
                title="Reading offline from local storage (saved 24h, 0 data)"
              >
                ⚡<span className="rt-offline-txt"> Offline (24h)</span>
              </span>
            ) : (
              <button
                onClick={handleStartDownload}
                className="rt-btn rt-save-btn"
                title="Save this chapter for 24 hours of offline reading"
                aria-label="Save this chapter for 24 hours of offline reading"
              >
                ⚡<span className="rt-offline-txt"> Save (24h)</span>
              </button>
            )}

            <div className="rt-sep"></div>
            <button className="rt-btn" onClick={() => setBrightnessPop(!brightnessPop)} aria-label="Adjust brightness">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {showNav && (
          <div
            className="reader-prog-bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percent = clickX / rect.width;
              const targetPage = Math.max(1, Math.ceil(percent * TOTAL_PAGES));
              if (viewMode === "paged") {
                setPage(targetPage);
              } else {
                const pageEls = readerPagesRef.current?.querySelectorAll(".reader-page");
                if (pageEls && pageEls[targetPage - 1]) {
                  pageEls[targetPage - 1].scrollIntoView({ behavior: "smooth" });
                }
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <div
              className="reader-prog-fill"
              style={{ width: `${(page / TOTAL_PAGES) * 100}%` }}
            ></div>
          </div>
        )}

        {/* Brightness filter overlay */}
        <div
          className="reader-brightness"
          style={{
            opacity: (brightness / 100) * 0.85,
            pointerEvents: "none",
          }}
        />

        {/* Brightness Popover Slider */}
        {brightnessPop && (
          <div
            className="brightness-pop open"
            style={{ display: "flex" }}
            onMouseEnter={resetBrightnessTimer}
            onMouseMove={resetBrightnessTimer}
            onTouchStart={resetBrightnessTimer}
            onTouchMove={resetBrightnessTimer}
          >
            <button
              className="brightness-close"
              onClick={() => setBrightnessPop(false)}
              aria-label="Close brightness"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="brightness-label">Brightness</div>
            <input
              type="range"
              className="brightness-slider"
              min="0"
              max="80"
              value={brightness}
              onChange={(e) => {
                setBrightness(parseInt(e.target.value));
                resetBrightnessTimer();
              }}
              style={{ cursor: "pointer" }}
            />
            <div className="brightness-label" style={{ marginTop: "140px" }}>{100 - brightness}%</div>
          </div>
        )}
        {/* Manga Pages List */}
        <div className="reader-pages" ref={readerPagesRef} style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center", width: "100%", cursor: "pointer", maxWidth: "800px", margin: "0 auto", padding: 0 }}>
          {images.map((imgUrl, i) => {
            if (viewMode === "paged" && i !== page - 1) return null;
            const fileName = imgUrl.startsWith('data:') ? `Page ${i + 1}` : (imgUrl.split('/').pop().split('?')[0] || `Page ${i + 1}`);
            const hasError = imgErrors[i];
            return (
              <Fragment key={i}>
              <div
                className="reader-page"
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: viewMode === "paged" ? "100vh" : (loadedImages[i] ? "auto" : "550px"),
                  height: viewMode === "paged" ? "100vh" : "auto",
                  background: loadedImages[i] ? "none" : "#0d0714",
                  display: "flex",
                  justifyContent: viewMode === "paged" ? "center" : (zoomedImage === i ? "flex-start" : "center"),
                  alignItems: viewMode === "paged" ? "center" : "flex-start",
                  overflowX: zoomedImage === i ? "auto" : "hidden",
                  overflowY: zoomedImage === i && viewMode === "paged" ? "auto" : "hidden"
                }}
              >
                {!loadedImages[i] && !hasError && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      fontWeight: 500,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        border: "2px solid rgba(168,85,247,0.25)",
                        borderTopColor: "var(--p)",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>Loading Page {i + 1}...</span>
                  </div>
                )}
                {hasError ? (
                  <div onClick={() => { setImgErrors(prev => { const n = {...prev}; delete n[i]; return n; }); setImgRetries(prev => { const n = {...prev}; delete n[i]; return n; }); setLoadedImages(prev => { const n = {...prev}; delete n[i]; return n; }); }} style={{
                    width: "100%", cursor: "pointer",
                    aspectRatio: "2/3",
                    background: "var(--bg2)",
                    border: "1px solid var(--border2)",
                    borderRadius: "var(--r)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    padding: "24px",
                    textAlign: "center",
                    zIndex: 2,
                  }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div style={{ color: "var(--text)", fontSize: "14px", fontWeight: 600 }}>
                      Failed to load &quot;{fileName}&quot;
                    </div>
                    <div style={{ color: "var(--text2)", fontSize: "12px", lineHeight: 1.5 }}>
                      Image unavailable. Tap to retry.
                    </div>
                  </div>
                ) : (
                  <img
                    src={proxyImage(imgUrl)}
                    alt={`Page ${i + 1}`}
                    loading={isOfflineMode || imgUrl.startsWith('data:') ? "eager" : (i < 2 || (viewMode === "paged" && i === page - 1) ? "eager" : "lazy")}
                    decoding={isOfflineMode || imgUrl.startsWith('data:') ? "sync" : "async"}
                    fetchPriority={isOfflineMode || imgUrl.startsWith('data:') ? "high" : (i < 2 ? "high" : "auto")}
                    onLoad={() => setLoadedImages(prev => ({ ...prev, [i]: true }))}
                    style={{
                      width: viewMode === "paged" ? "auto" : (zoomedImage === i ? "150%" : "100%"),
                      height: viewMode === "paged" ? (zoomedImage === i ? "200vh" : "100%") : "auto",
                      objectFit: "contain",
                      maxWidth: zoomedImage === i ? "none" : "100%",
                      transform: "none",
                      transformOrigin: "center center",
                      transition: "width 0.2s ease, height 0.2s ease",
                      cursor: zoomedImage === i ? "zoom-out" : "zoom-in",
                      display: "block",
                      margin: "0 auto",
                      position: "relative",
                      zIndex: 2,
                    }}
                    onError={(e) => {
                      setLoadedImages(prev => ({ ...prev, [i]: true }));
                      const img = e.currentTarget || e.target;
                      if (img) {
                        try {
                          if (imgUrl.startsWith('data:') || imgUrl.startsWith('blob:')) {
                            setImgErrors(prev => ({ ...prev, [i]: true }));
                            return;
                          }
                          const u = new URL(img.src);
                          const rawUrl = u.searchParams.get('url') || imgUrl;
                          const API = API_BASE || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SCRAPER_URL || '';
                          if (!img.src.includes('/api/proxy-image') && API) {
                            img.src = `${API}/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
                          } else {
                            setImgErrors(prev => ({ ...prev, [i]: true }));
                          }
                        } catch {
                          setImgErrors(prev => ({ ...prev, [i]: true }));
                        }
                      } else {
                        setImgErrors(prev => ({ ...prev, [i]: true }));
                      }
                    }}
                    onDoubleClick={() => setZoomedImage(zoomedImage === i ? null : i)}
                  />
                )}
                {viewMode === "webtoon" && (
                  <div className="reader-page-num" aria-live="polite" style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", zIndex: 3 }}>
                    {i + 1}/{TOTAL_PAGES}
                  </div>
                )}
              </div>
              {/* The one inline ad slot, between page 3 and page 4. A sibling
                  of .reader-page, never a child, so the `.reader-page img`
                  index used by the retry handler above stays aligned with the
                  image list. */}
              {viewMode === "webtoon" &&
                i === AD_AFTER_PAGE - 1 &&
                i < images.length - 1 && <AAdsInline />}
              </Fragment>
            );
          })}
          <div ref={endRef} style={{ width: '100%', height: '1px' }} />
        </div>

        {/* Bottom Footer Actions */}
        {showNav && (
          <div className="reader-footer">
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: "14px", marginBottom: 0 }}>
              End of Chapter {id}
            </div>
            <AAdsBanner style={{ marginTop: 0 }} />
            <div className="reader-footer-btns" style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: 0, flexWrap: "wrap", maxWidth: "100%", padding: "0 10px" }}>
              <button
                className="rt-btn"
                style={{ padding: "8px 14px", height: "auto" }}
                onClick={() => router.back()}
              >
                ← Back
              </button>
              {isOfflineMode || savedOfflineChapters.has(parseInt(id)) ? (
                <div
                  style={{
                    padding: "8px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#4ade80",
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                  title="Stored on device for 24 hours (0 data used)"
                >
                  <span>⚡ Saved Offline (24h)</span>
                </div>
              ) : (
                <button
                  onClick={handleStartDownload}
                  className="rt-btn"
                  style={{
                    padding: "8px 14px",
                    height: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#c084fc",
                    background: "rgba(168, 85, 247, 0.12)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                  title="Save this chapter for 24 hours of offline reading"
                  aria-label="Save this chapter for 24 hours of offline reading"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Save Offline (24h)</span>
                </button>
              )}
              <button
                className="rt-btn"
                style={{
                  padding: "8px 16px",
                  height: "auto",
                  background: "var(--accent)",
                  color: "#fff",
                  opacity: (!mappedChapters.some(c => c.chNum === parseInt(id) + 1) && !savedOfflineChapters.has(parseInt(id) + 1)) ? 0.5 : 1
                }}
                onClick={goToNextChapter}
                disabled={!mappedChapters.some(c => c.chNum === parseInt(id) + 1) && !savedOfflineChapters.has(parseInt(id) + 1)}
              >
                {savedOfflineChapters.has(parseInt(id) + 1)
                  ? `Next Chapter (Ch ${parseInt(id) + 1} Offline ⚡) →`
                  : "Next Chapter →"}
              </button>
            </div>
          </div>
        )}

        {/* Floating Scroll Controls */}
        {showNav && (
          <div className="reader-float" id="reader-float" style={{ display: "flex" }}>
            <button className="rf-btn" onClick={handleScrollTop} aria-label="Scroll to top">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="rf-btn" onClick={handleScrollBot} aria-label="Scroll to bottom">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M19 12l-7 7-7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}

        <RewardedAdModal
          isOpen={showRewardedModal}
          onClose={() => setShowRewardedModal(false)}
          onReward={() => {
            // Download finishes via JSZip in background
          }}
          chapterTitle={`${title ? title + ' - ' : ''}Chapter ${id}`}
          packProgress={packProgress}
        />
      </div>
    </div>
  );
}

export default function Reader({ params }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
        <ReaderContent params={params} />
      </Suspense>
    </ErrorBoundary>
  );
}
