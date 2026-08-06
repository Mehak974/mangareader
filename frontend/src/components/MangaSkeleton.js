"use client";

import React from "react";

export default function MangaSkeleton({ count = 12 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="m-card skeleton">
          <div className="m-cover skeleton-cover" />
          <div className="m-skeleton-title" />
        </div>
      ))}
    </>
  );
}
