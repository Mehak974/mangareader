"use client";

import React, { use, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";
import Loader from "@/components/Loader";
import { useApp } from "@/context/AppContext";
import Image from "next/image";
import { API_BASE, proxyImage } from "@/utils/api";
import { useDrag } from "@use-gesture/react";

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

  const [images, setImages] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [brightnessPop, setBrightnessPop] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [viewMode, setViewMode] = useState("webtoon");
  const [showNav, setShowNav] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);

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

  // Fetch chapter images
  useEffect(() => {
    if (!url) {
      setError("No chapter URL provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch chapter images from server");
        return res.json();
      })
      .then((res) => {
        if (res.data && res.data.images && res.data.images.length > 0) {
          setImages(res.data.images);
          setLoading(false);
          // Log to reading history
          addToHistory(title || "Manga", `Chapter ${id}`, parseInt(id) || 1, url, source, mangaId, cover);
        } else {
          throw new Error("No images found in server response");
        }
      })
      .catch((err) => {
        console.warn("Reader fetch error, falling back to mock panels:", err.message);
        
        // Generate mock comic panels as SVG data URLs
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
      });
  }, [url, source, id, title]);

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

  const goToNextChapter = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    
    // Match by href first, fallback to matching chapter number from route params (id is totalChapters - chapterNumber)
    let currentIdx = chapters.findIndex(ch => ch.href === url);
    if (currentIdx === -1 && id) {
      const chNumFromUrl = parseInt(id);
      currentIdx = chapters.length - chNumFromUrl;
    }
    
    if (currentIdx > 0) {
      const next = chapters[currentIdx - 1];
      router.push(`/reader/${chapters.length - currentIdx + 1}?url=${encodeURIComponent(next.href || "")}&source=${source}&title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(cover)}`);
    } else {
      isNavigatingRef.current = false;
    }
  };

  const goToPrevChapter = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    
    let currentIdx = chapters.findIndex(ch => ch.href === url);
    if (currentIdx === -1 && id) {
      const chNumFromUrl = parseInt(id);
      currentIdx = chapters.length - chNumFromUrl;
    }
    
    if (currentIdx < chapters.length - 1 && currentIdx !== -1) {
      const prev = chapters[currentIdx + 1];
      router.push(`/reader/${chapters.length - currentIdx - 1}?url=${encodeURIComponent(prev.href || "")}&source=${source}&title=${encodeURIComponent(title)}&mangaId=${encodeURIComponent(mangaId)}&cover=${encodeURIComponent(cover)}`);
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
      <div className="reader-toolbar" style={{ display: "flex", gap: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>
        <button className="rt-btn" onClick={() => router.back()} style={{ flexShrink: 0 }} aria-label="Go back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <button className="rt-btn" onClick={() => router.push("/")} style={{ flexShrink: 0 }} aria-label="Go to home">
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
        <button className="rt-btn" onClick={() => window.location.reload()} style={{ flexShrink: 0 }} aria-label="Reload chapter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v5h5M20 20v-5h-5M4.93 19.07A10 10 0 102.12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        
        <div className="rt-sep" style={{ flexShrink: 0 }}></div>
        {chapters.length > 0 ? (
          <select
            value={(() => {
              const idx = chapters.findIndex(ch => ch.href === url);
              if (idx !== -1) return idx;
              if (id) return chapters.length - parseInt(id);
              return 0;
            })()}
            onChange={handleChapterSelect}
            style={{
              background: "var(--bg3)",
              color: "#fff",
              border: "none",
              padding: "8px",
              borderRadius: "6px",
              fontSize: "14px",
              flex: "1",
              maxWidth: "150px"
            }}
            aria-expanded="false"
            aria-label="Select chapter"
          >
            {chapters.map((ch, idx) => (
              <option key={idx} value={idx} style={{ background: "#180e25", color: "#fff" }}>
                {ch.title || `Chapter ${chapters.length - idx}`}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: "13px", color: "#fff", fontWeight: "600", flexShrink: 0 }}>
            Chapter {id}
          </span>
        )}

        <div className="rt-sep"></div>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,.3)", padding: "0 4px" }}>
          {page}/{TOTAL_PAGES}
        </span>

        <div className="rt-sep"></div>
        <button className="rt-btn" onClick={goToPrevChapter} aria-label="Previous chapter" disabled={!mappedChapters.some(c => c.chNum === parseInt(id) - 1)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="rt-btn" onClick={goToNextChapter} aria-label="Next chapter" disabled={!mappedChapters.some(c => c.chNum === parseInt(id) + 1)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>



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
      <div className="reader-prog-bar">
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
      <div className="reader-pages" ref={readerPagesRef} style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center", width: "100%", maxWidth: "800px", margin: "0 auto", padding: 0 }}>
        {images.map((imgUrl, i) => {
          if (viewMode === "paged" && i !== page - 1) return null;
          const fileName = imgUrl.split('/').pop().split('?')[0] || `Page ${i + 1}`;
          const hasError = imgErrors[i];
          return (
            <div
              key={i}
              className="reader-page"
              style={{
                position: "relative",
                width: "100%",
                height: viewMode === "paged" ? "100vh" : "auto",
                background: "none",
                display: "flex",
                justifyContent: viewMode === "paged" ? "center" : (zoomedImage === i ? "flex-start" : "center"),
                alignItems: viewMode === "paged" ? "center" : "flex-start",
                overflowX: zoomedImage === i ? "auto" : "hidden",
                overflowY: "hidden"
              }}
            >
              {hasError ? (
                <div style={{
                  width: "100%",
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
                  textAlign: "center"
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div style={{ color: "var(--text)", fontSize: "14px", fontWeight: 600 }}>
                    Cannot read &quot;{fileName}&quot;
                  </div>
                  <div style={{ color: "var(--text2)", fontSize: "12px", lineHeight: 1.5 }}>
                    this model does not support image input
                  </div>
                </div>
              ) : (
                <Image 
                     src={proxyImage(imgUrl)} 
                    alt={`Page ${i + 1}`} 
                    width={800}
                    height={1200}
                    style={{ 
                      width: viewMode === "paged" ? "auto" : (zoomedImage === i ? "150%" : "100%"), 
                      height: viewMode === "paged" ? "100%" : "auto", 
                      maxHeight: viewMode === "paged" ? "100vh" : "none", 
                      maxWidth: zoomedImage === i ? "none" : "100%",
                      objectFit: "contain", 
                      display: "block",
                      transform: "none",
                      transition: "width 0.25s ease-in-out",
                      cursor: zoomedImage === i ? "zoom-out" : "zoom-in"
                    }} 
                    priority={i < 2 || (viewMode === "paged" && i === page - 1)}
                    unoptimized={true}
                    onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
                    onDoubleClick={() => setZoomedImage(zoomedImage === i ? null : i)}
                  />
                )}
                {viewMode === "webtoon" && (
                <div className="reader-page-num" aria-live="polite" style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "10px" }}>
                  {i + 1}/{TOTAL_PAGES}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} style={{ width: '100%', height: '1px' }} />
      </div>

      {/* Bottom Footer Actions */}
      {showNav && (
      <div className="reader-footer">
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: "14px", marginBottom: "12px" }}>
          End of Chapter {id}
        </div>
        <div className="reader-footer-btns" style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            className="rt-btn"
            style={{ padding: "8px 16px", height: "auto" }}
            onClick={() => router.back()}
          >
            ← Back to Detail
          </button>
          <button
            className="rt-btn"
            style={{ padding: "8px 16px", height: "auto", background: "var(--accent)", color: "#fff", opacity: chapters.findIndex(ch => ch.href === url) <= 0 ? 0.5 : 1 }}
            onClick={goToNextChapter}
            disabled={!mappedChapters.some(c => c.chNum === parseInt(id) + 1)}
          >
            Next Chapter →
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
