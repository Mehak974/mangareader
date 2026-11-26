"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import MangaCard from "@/components/MangaCard";
import Footer from "@/components/Footer";
import { proxyImage } from "@/utils/api";
import { slugify } from "@/utils/slugify";
import { getMangaHref } from "@/lib/dmcaBlacklist";
import {
  getAllOfflineChapters,
  deleteOfflineChapter,
  deleteOfflineManga,
  clearAllOfflineChapters,
} from "@/utils/offlineStorage";

export default function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoggedIn, libraries, readManga, setSigninSheetOpen, createLibrary, deleteLibrary } = useApp();
  const [selectedLibraryId, setSelectedLibraryId] = useState(null);
  const [activeTab, setActiveTab] = useState("collections");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Search & genre filter state for collections
  const [collectionSearch, setCollectionSearch] = useState("");
  const [collectionGenre, setCollectionGenre] = useState("ALL");

  // Offline downloads state
  const [downloadedChapters, setDownloadedChapters] = useState([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);

  // Read initial tab parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "completed" || tabParam === "collections" || tabParam === "downloaded") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Load offline chapters from IndexedDB
  const loadDownloads = useCallback(async () => {
    try {
      const list = await getAllOfflineChapters();
      setDownloadedChapters(list || []);
    } catch (err) {
      console.warn("Failed to load offline chapters in library:", err);
      setDownloadedChapters([]);
    } finally {
      setLoadingDownloads(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
    const handleUpdate = () => loadDownloads();
    window.addEventListener("offline-chapters-updated", handleUpdate);
    return () => window.removeEventListener("offline-chapters-updated", handleUpdate);
  }, [loadDownloads]);

  // Group downloaded chapters by manga title
  const groupedDownloads = useMemo(() => {
    const map = new Map();
    for (const item of downloadedChapters) {
      const key = String(item.mangaId || item.mangaTitle || "unknown").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          mangaId: item.mangaId,
          mangaTitle: item.mangaTitle || "Untitled Manga",
          cover: item.cover,
          chapters: [],
        });
      }
      map.get(key).chapters.push(item);
    }

    // Sort chapters ascending for each manga
    for (const g of map.values()) {
      g.chapters.sort((a, b) => (Number(a.chapterNum) || 0) - (Number(b.chapterNum) || 0));
    }

    return Array.from(map.values());
  }, [downloadedChapters]);

  // Find selected library
  const selectedLibrary = selectedLibraryId
    ? libraries.find((l) => l.id === selectedLibraryId)
    : null;

  // Extract unique genres from the current collection
  const availableGenres = useMemo(() => {
    if (!selectedLibrary?.manga) return [];
    const set = new Set();
    selectedLibrary.manga.forEach((m) => {
      const raw = m.genre || m.g;
      if (Array.isArray(raw)) {
        raw.forEach((g) => {
          if (typeof g === "string" && g.trim()) set.add(g.trim());
        });
      } else if (typeof raw === "string" && raw.trim()) {
        raw.split(/[,/]/).forEach((g) => {
          const trimmed = g.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [selectedLibrary]);

  // Filter manga in the collection by search query and genre
  const filteredCollectionManga = useMemo(() => {
    if (!selectedLibrary?.manga) return [];
    const q = (collectionSearch || "").toLowerCase().trim();
    return selectedLibrary.manga.filter((m) => {
      const title = (m.title || m.t || "").toLowerCase();
      const matchesSearch = !q || title.includes(q);

      let matchesGenre = true;
      if (collectionGenre && collectionGenre !== "ALL") {
        const raw = m.genre || m.g;
        if (Array.isArray(raw)) {
          matchesGenre = raw.some(
            (g) => typeof g === "string" && g.toLowerCase().trim() === collectionGenre.toLowerCase().trim()
          );
        } else if (typeof raw === "string") {
          matchesGenre = raw.toLowerCase().includes(collectionGenre.toLowerCase().trim());
        } else {
          matchesGenre = false;
        }
      }
      return matchesSearch && matchesGenre;
    });
  }, [selectedLibrary, collectionSearch, collectionGenre]);

  // Series the user marked read
  const completedManga = useMemo(() => {
    const read = new Set(readManga || []);
    const seen = new Set();
    const out = [];
    for (const lib of libraries) {
      for (const m of lib.manga || []) {
        if (!m.title || !read.has(m.title)) continue;
        const key = String(m.mangaId ?? m.title);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: m.mangaId,
          t: m.title,
          cover: m.cover,
          ongoing: m.ongoing,
          rating: m.rating,
          g: m.genre,
        });
      }
    }
    return out;
  }, [libraries, readManga]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSelectedLibraryId(null);
    router.replace(tab === "collections" ? "/library" : `/library?tab=${tab}`, { scroll: false });
  };

  const handleDeleteChapter = async (e, ch, mangaTitle) => {
    e.stopPropagation();
    if (confirm(`Remove Chapter ${ch.chapterNum} from offline storage?`)) {
      await deleteOfflineChapter(ch.mangaId, ch.chapterNum, mangaTitle);
      loadDownloads();
    }
  };

  const handleDeleteManga = async (e, g) => {
    e.stopPropagation();
    if (confirm(`Remove all downloaded chapters for "${g.mangaTitle}"?`)) {
      await deleteOfflineManga(g.mangaId, g.mangaTitle);
      loadDownloads();
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to delete all offline downloaded chapters from this device?")) {
      await clearAllOfflineChapters();
      loadDownloads();
    }
  };

  const handleCreateCollection = async (e) => {
    e?.preventDefault();
    const trimmed = (newCollectionName || "").trim();
    if (!trimmed) return;
    setCreatingCollection(true);
    const success = await createLibrary(trimmed);
    if (success) {
      setNewCollectionName("");
      setShowCreateCollection(false);
    }
    setCreatingCollection(false);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 16px 80px" }}>
      {/* Header & Tabs available for all users */}
      <h1 style={{ fontSize: "26px", fontWeight: 800, marginBottom: "18px", color: "var(--text, #e8deff)" }}>
        Library
      </h1>

      <div className="lib-tabs" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        <button
          className={`lib-tab ${activeTab === "collections" ? "active" : ""}`}
          onClick={() => switchTab("collections")}
          style={{ cursor: "pointer" }}
        >
          Collections
        </button>
        <button
          className={`lib-tab ${activeTab === "completed" ? "active" : ""}`}
          onClick={() => switchTab("completed")}
          style={{ cursor: "pointer" }}
        >
          Completed
        </button>
        <button
          className={`lib-tab ${activeTab === "downloaded" ? "active" : ""}`}
          onClick={() => switchTab("downloaded")}
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>📥 Downloaded</span>
          {downloadedChapters.length > 0 && (
            <span
              style={{
                background: "var(--accent, #a855f7)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 800,
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {downloadedChapters.length}
            </span>
          )}
        </button>
        {activeTab === "collections" && selectedLibrary && (
          <button className="lib-tab active" style={{ background: "var(--surface2)" }}>
            {selectedLibrary.name === "default" ? "Default Library" : selectedLibrary.name}
          </button>
        )}
      </div>

      {/* ── DOWNLOADED TAB (Accessible to BOTH guests and logged-in users) ── */}
      {activeTab === "downloaded" ? (
        <div className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "20px",
              paddingBottom: "12px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px 0", color: "#ffffff" }}>
                Offline Downloads
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text2)" }}>
                Chapters saved locally on this device. Readable anytime without an active internet connection.
              </p>
            </div>

            {downloadedChapters.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                Clear All Downloads
              </button>
            )}
          </div>

          {loadingDownloads ? (
            <div style={{ textAlign: "center", padding: "50px", color: "var(--text3)" }}>
              Scanning offline storage...
            </div>
          ) : groupedDownloads.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "var(--surface)",
                border: "1px dashed var(--border)",
                borderRadius: "16px",
                maxWidth: "500px",
                margin: "20px auto",
              }}
            >
              <div style={{ fontSize: "44px", marginBottom: "12px" }}>📥</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0", color: "#ffffff" }}>
                No Offline Chapters Saved
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text2)", lineHeight: 1.5, margin: "0 0 20px 0" }}>
                You haven&apos;t downloaded any manga chapters yet. When reading or browsing manga, tap the download icon on any chapter to read offline.
              </p>
              <Link
                href="/browse"
                className="btn btn-p"
                style={{
                  textDecoration: "none",
                  display: "inline-block",
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Browse Popular Manga →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {groupedDownloads.map((g) => (
                <div
                  key={g.mangaTitle}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "flex",
                    gap: "18px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Manga Cover */}
                  <Link
                    href={getMangaHref(g.mangaTitle, g.cover, true)}
                    style={{
                      position: "relative",
                      width: "74px",
                      height: "105px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "var(--surface2)",
                      display: "block",
                    }}
                  >
                    {g.cover ? (
                      <Image
                        src={proxyImage(g.cover, 120)}
                        alt={g.mangaTitle}
                        fill
                        sizes="74px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text3)",
                          fontSize: "12px",
                        }}
                      >
                        📖
                      </div>
                    )}
                  </Link>

                  {/* Manga Info & Chapters */}
                  <div style={{ flex: 1, minWidth: "240px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "10px",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <Link
                          href={getMangaHref(g.mangaTitle, g.cover, true)}
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "#ffffff",
                            textDecoration: "none",
                            lineHeight: 1.3,
                          }}
                        >
                          {g.mangaTitle}
                        </Link>
                        <div style={{ fontSize: "12px", color: "var(--accent2)", marginTop: "3px" }}>
                          {g.chapters.length} chapter{g.chapters.length === 1 ? "" : "s"} available offline
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteManga(e, g)}
                        title="Delete all downloaded chapters for this series"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text3)",
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          transition: "color 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
                      >
                        Remove Series ✕
                      </button>
                    </div>

                    {/* Chapter list pills */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                      {g.chapters.map((ch) => {
                        const readerUrl = `/reader/${ch.chapterNum}?title=${encodeURIComponent(
                          g.mangaTitle
                        )}&mangaId=${encodeURIComponent(g.mangaId || "")}`;

                        return (
                          <div
                            key={ch.key || ch.chapterNum}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              background: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              overflow: "hidden",
                              fontSize: "12px",
                            }}
                          >
                            <Link
                              href={readerUrl}
                              style={{
                                padding: "6px 10px",
                                color: "var(--text)",
                                textDecoration: "none",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              <span>📖 Ch. {ch.chapterNum}</span>
                              <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                                ({ch.pageCount || (ch.images ? ch.images.length : 0)}p)
                              </span>
                            </Link>

                            <button
                              onClick={(e) => handleDeleteChapter(e, ch, g.mangaTitle)}
                              title={`Delete Chapter ${ch.chapterNum}`}
                              style={{
                                background: "rgba(255, 255, 255, 0.04)",
                                border: "none",
                                borderLeft: "1px solid var(--border)",
                                color: "var(--text3)",
                                padding: "6px 8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                e.currentTarget.style.color = "#f87171";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                                e.currentTarget.style.color = "var(--text3)";
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── COLLECTIONS & COMPLETED TABS ── */
        <div className="section">
          {!isLoggedIn && (
            <div
              style={{
                background: "rgba(168, 85, 247, 0.08)",
                border: "1px solid rgba(168, 85, 247, 0.2)",
                borderRadius: "var(--rm)",
                padding: "12px 16px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                💡 <b>Guest Mode:</b> Collections are saved locally to this device. Sign in to sync across all your devices.
              </div>
              <button
                className="btn btn-p"
                onClick={() => setSigninSheetOpen(true)}
                style={{ fontSize: "12px", padding: "5px 12px" }}
              >
                Sign in free
              </button>
            </div>
          )}

          {activeTab === "completed" ? (
            completedManga.length ? (
              <div className="lib-manga-grid">
                {completedManga.map((m, idx) => (
                  <MangaCard key={m.id ?? m.t} manga={m} index={idx} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text3)" }}>
                Nothing completed yet. Mark a series read from its card and it will show up here.
              </div>
            )
          ) : !selectedLibrary ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
                <div className="s-title" style={{ margin: 0 }}>My Collections</div>
                {!showCreateCollection ? (
                  <button
                    className="btn btn-p"
                    onClick={() => setShowCreateCollection(true)}
                    style={{ fontSize: "13px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <span>＋</span> New Collection
                  </button>
                ) : (
                  <form
                    onSubmit={handleCreateCollection}
                    style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
                  >
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name..."
                      maxLength={100}
                      autoFocus
                      disabled={creatingCollection}
                      style={{
                        padding: "6px 12px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--rm)",
                        color: "var(--text)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      className="btn btn-p"
                      disabled={!newCollectionName.trim() || creatingCollection}
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                    >
                      {creatingCollection ? "Creating..." : "Create"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => { setShowCreateCollection(false); setNewCollectionName(""); }}
                      style={{
                        fontSize: "13px",
                        padding: "6px 10px",
                        background: "var(--surface2)",
                        border: "none",
                        color: "var(--text3)",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
              <div className="coll-grid">
                {libraries.map((c) => (
                  <div
                    key={c.id}
                    className="coll-card"
                    onClick={() => setSelectedLibraryId(c.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="coll-covers">
                      {c.manga?.slice(0, 4).map((m, i) => (
                        <div key={i} className="coll-cov">
                          {m.cover ? (
                            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "4px", overflow: "hidden" }}>
                              <Image
                                src={proxyImage(m.cover, 60)}
                                alt={`Cover for ${m.title}`}
                                fill
                                sizes="(max-width: 768px) 55px, 60px"
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
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    onClick={() => {
                      setSelectedLibraryId(null);
                      setCollectionSearch("");
                      setCollectionGenre("ALL");
                    }}
                    className="btn"
                    style={{
                      padding: "6px 12px",
                      background: "var(--surface2)",
                      borderRadius: "var(--rm)",
                      border: "none",
                      color: "var(--text2)",
                      cursor: "pointer",
                    }}
                  >
                    &larr; Back
                  </button>
                  <div className="s-title" style={{ margin: 0 }}>{selectedLibrary.name === "default" ? "Default Library" : selectedLibrary.name}</div>
                  <span style={{ fontSize: "12px", color: "var(--text3)" }}>
                    ({selectedLibrary.manga?.length || 0} titles)
                  </span>
                </div>
                {selectedLibrary.name !== "default" && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete the collection "${selectedLibrary.name}"?`)) {
                        await deleteLibrary(selectedLibrary.id);
                        setSelectedLibraryId(null);
                        setCollectionSearch("");
                        setCollectionGenre("ALL");
                      }
                    }}
                    className="btn"
                    style={{
                      fontSize: "12px",
                      padding: "5px 10px",
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "#ef4444",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      borderRadius: "var(--rm)",
                      cursor: "pointer",
                    }}
                  >
                    Delete Collection
                  </button>
                )}
              </div>

              {/* Search & Genre Filter Bar */}
              {selectedLibrary.manga && selectedLibrary.manga.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "20px",
                    flexWrap: "wrap",
                    background: "var(--surface)",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Search Input */}
                  <div style={{ flex: 1, minWidth: "220px", position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: "12px", color: "var(--text3)", pointerEvents: "none", fontSize: "14px" }}>
                      🔍
                    </span>
                    <input
                      type="text"
                      value={collectionSearch}
                      onChange={(e) => setCollectionSearch(e.target.value)}
                      placeholder="Search title in this collection..."
                      style={{
                        width: "100%",
                        padding: "8px 32px 8px 36px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--text, #ffffff)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    {collectionSearch && (
                      <button
                        type="button"
                        onClick={() => setCollectionSearch("")}
                        style={{
                          position: "absolute",
                          right: "8px",
                          background: "transparent",
                          border: "none",
                          color: "var(--text3)",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "2px 6px",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Genre Filter Dropdown */}
                  {availableGenres.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 600 }}>Genre:</span>
                      <select
                        value={collectionGenre}
                        onChange={(e) => setCollectionGenre(e.target.value)}
                        style={{
                          padding: "8px 12px",
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          color: "var(--text, #ffffff)",
                          fontSize: "13px",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="ALL">All Genres ({selectedLibrary.manga.length})</option>
                        {availableGenres.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Reset Filter Button */}
                  {(collectionSearch || collectionGenre !== "ALL") && (
                    <button
                      onClick={() => {
                        setCollectionSearch("");
                        setCollectionGenre("ALL");
                      }}
                      style={{
                        background: "rgba(168, 85, 247, 0.12)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        color: "var(--accent2, #c084fc)",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "7px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}

              {/* Filter Results Info */}
              {selectedLibrary.manga && selectedLibrary.manga.length > 0 && (collectionSearch || collectionGenre !== "ALL") && (
                <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "14px" }}>
                  Showing {filteredCollectionManga.length} of {selectedLibrary.manga.length} titles
                </div>
              )}

              {/* Manga Grid or Empty State */}
              {selectedLibrary.manga && selectedLibrary.manga.length > 0 ? (
                filteredCollectionManga.length > 0 ? (
                  <div className="lib-manga-grid">
                    {filteredCollectionManga.map((m) => (
                      <MangaCard key={m.id || m.mangaId} manga={m} />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      background: "var(--surface)",
                      borderRadius: "12px",
                      border: "1px dashed var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "#ffffff" }}>
                      No Matching Manga Found
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--text3)", margin: "0 0 16px 0" }}>
                      No series found matching {collectionSearch ? `"${collectionSearch}"` : ""}{" "}
                      {collectionGenre !== "ALL" ? `in genre "${collectionGenre}"` : ""}.
                    </p>
                    <button
                      className="btn btn-p"
                      onClick={() => {
                        setCollectionSearch("");
                        setCollectionGenre("ALL");
                      }}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      Clear Filters
                    </button>
                  </div>
                )
              ) : (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text3)" }}>
                  This collection is empty.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}
