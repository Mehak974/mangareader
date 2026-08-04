"use client";

import { useEffect, useRef } from "react";

export default function ViewTracker({ articleId }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!articleId || tracked.current) return;
    
    // Only track once per page load
    tracked.current = true;
    
    fetch("/api/blog/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleId }),
    }).catch(err => {
      console.error("Failed to track view:", err);
      // Reset so it can try again if there was a network error
      tracked.current = false;
    });
  }, [articleId]);

  return null;
}
