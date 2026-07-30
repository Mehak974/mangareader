"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { COVER_GRADS, abbr } from "@/data/mockData";
import { isExplicitNSFW } from "@/utils/anilist";
import { slugify } from "@/utils/slugify";

export default function MangaCard({ manga, index }) {
  const router = useRouter();
  const {
    hiddenGenres,
    unhideGenre,
    readManga,
    toggleRead,
    isBookmarked,
    toggleBookmark,
    isNSFW
  } = useApp();

  const [revealed, setRevealed] = React.useState(false);
  const isNSFWItem = React.useMemo(() => isExplicitNSFW(manga.genres || (manga.g ? [manga.g] : []), manga.t || "", {
    tags: manga.tags,
    isAdult: manga.isAdult,
  }), [manga.genres, manga.g, manga.t, manga.tags, manga.isAdult]);
  const shouldBlur = isNSFWItem && !revealed;

  const isHidden = hiddenGenres.includes(manga.g);
  const isRead = readManga.includes(manga.t || manga.title);
  const bookmarked = isBookmarked(manga.id);
  const bg = COVER_GRADS[index % COVER_GRADS.length];
  const handleCardClick = () => {
    if (!isHidden && (!isNSFWItem || revealed)) {
      router.push(`/manga/${slugify(manga.t || manga.title)}`);
    }
  };
  const imageUrl = manga.cover || null;
  const coverStyle = imageUrl
    ? {
        filter: shouldBlur ? "blur(40px) brightness(0.3)" : "none",
        transition: "filter 0.3s ease"
      }
    : { background: bg, filter: shouldBlur ? "blur(40px) brightness(0.3)" : "none" };

  return (
    <div
      className={`m-card ${isHidden ? "genre-hidden" : ""} ${isRead ? "read" : ""}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`Go to ${manga.t}`}
    >
      <div className="m-cover" style={coverStyle}>
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={`Cover for ${manga.t}`}
            fill
            sizes="(max-width: 768px) 50vw, 230px"
            style={{ objectFit: "cover" }}
            priority={index < 8}
            unoptimized={true}
          />
        )}
        <div className="m-shimmer" />
        {manga.hot && <div className="m-hot">HOT</div>}
        {manga.latest_source && <div className="m-source-badge">{manga.latest_source}</div>}
        <div className="m-rating">★{Number(manga.rating || 4.5).toFixed(1)}</div>
        <div className="m-read-badge">READ</div>

        {/* NSFW Warning overlay */}
        {isNSFWItem && !revealed && (
          <div 
            className="m-hidden-overlay nsfw-overlay" 
            onClick={(e) => {
              e.stopPropagation();
              const confirmed = window.confirm("This is adult manga, it may contain inappropriate content. Do you still want to reveal the cover?");
              if (confirmed) {
                setRevealed(true);
              }
            }}
            style={{
              background: "rgba(13, 7, 20, 0.95)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 5,
              borderRadius: "inherit",
              cursor: "pointer",
              padding: "10px",
              textAlign: "center"
            }}
          >
            <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px" }}>
              May contain explicit content
            </span>
            <button 
              style={{ 
                fontSize: "11px", 
                color: "#fff", 
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                borderRadius: "4px",
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              Show cover?
            </button>
          </div>
        )}

        {/* Hidden Genre overlay */}
        {isHidden && (
          <div className="m-hidden-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="m-hidden-label">
              Hidden genre
              <br />
              <small style={{ opacity: 0.7 }}>({manga.g})</small>
            </div>
            <button
              onClick={() => unhideGenre(manga.g)}
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,.7)",
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: "4px",
                padding: "3px 8px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Show
            </button>
          </div>
        )}

        {/* Card Actions overlay */}
        {!isHidden && (
          <div className="m-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="m-action-btn"
              onClick={() => toggleRead(manga.t)}
              title={isRead ? "Mark unread" : "Mark read"}
              aria-label={isRead ? "Mark as unread" : "Mark as read"}
            >
              {isRead ? "✓" : "○"}
            </button>
            <button
              className="m-action-btn"
              onClick={() => toggleBookmark({ id: manga.id, t: manga.t, cover: manga.cover, ongoing: manga.ongoing, rating: manga.rating, g: manga.g })}
              title={bookmarked ? "Remove from Library" : "Add to Library"}
              aria-label={bookmarked ? "Remove from Library" : "Add to Library"}
            >
              {bookmarked ? "★" : "＋"}
            </button>
          </div>
        )}

        {!manga.cover && <span style={{ position: "relative", zIndex: 1 }}>{abbr(manga.t || manga.title)}</span>}
      </div>
      <div className="m-title">{manga.t || manga.title}</div>
      <div className="m-meta">
        <span className={`m-dot ${manga.ongoing === false ? "done" : ""}`} />
        <span>
          {manga.ch && manga.ch !== "Ongoing"
            ? `${manga.g} · ${manga.ch}`
            : `${manga.g} · ${manga.ongoing === false ? "Completed" : "Ongoing"}`}
        </span>
      </div>
    </div>
  );
}
