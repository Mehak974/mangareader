"use client";

import { useEffect } from "react";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PageViewTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = window.location.pathname + window.location.search;
    if (path.startsWith("/admin") || path.startsWith("/api/")) return;

    let visitorId = localStorage.getItem("visitorId");
    if (!visitorId) {
      visitorId = generateId();
      localStorage.setItem("visitorId", visitorId);
    }

    const isPwa =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;

    const payload = {
      path: path.slice(0, 500),
      referrer: document.referrer || undefined,
      visitorId,
      isPwa,
    };

    const headers = {
      "Content-Type": "application/json",
    };

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
