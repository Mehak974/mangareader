/**
 * SkeletonCard — placeholder matching the final MangaCard footprint.
 *
 * Renders while the first batch of cards is loading so the grid doesn't
 * collapse (the main cause of CLS on /trending and /browse). Swap in the
 * real MangaCard once data arrives.
 */
import React from "react";

export default function SkeletonCard({ index = 0 }) {
  const grad = [
    "linear-gradient(135deg, #1e1b4b, #0f0a1f)",
    "linear-gradient(135deg, #0c1220, #0a0612)",
    "linear-gradient(135deg, #0e0f14, #16171f)",
  ][index % 3];

  return (
    <div
      className="skeleton-card"
      aria-hidden="true"
      style={{
        aspectRatio: "2/3",
        borderRadius: "var(--r, 8px)",
        background: grad,
        border: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          animation: "shimmer 1.4s infinite",
        }}
      />
    </div>
  );
}

export function SkeletonGrid({ count = 12, startIndex = 0 }) {
  return (
    <div className="manga-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} index={startIndex + i} />
      ))}
    </div>
  );
}