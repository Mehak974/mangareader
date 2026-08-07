"use client";

import { useEffect } from "react";

export default function PageViewTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const userId = localStorage.getItem("userId") || undefined;

    const payload = {
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
    };

    const headers = {
      "Content-Type": "application/json",
    };
    if (userId) headers["x-user-id"] = userId;

    const beacon = navigator.sendBeacon
      ? navigator.sendBeacon("/api/page-view", JSON.stringify(payload))
      : false;

    if (!beacon) {
      fetch("/api/page-view", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  return null;
}
