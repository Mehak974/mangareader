"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = window.location.pathname + window.location.search;
    if (path.startsWith("/admin") || path.startsWith("/api/")) return;

    let visitorId = localStorage.getItem("visitorId");
    if (!visitorId) {
      visitorId = generateId();
      try {
        localStorage.setItem("visitorId", visitorId);
      } catch {
        // localStorage may be unavailable
      }
    }

    const userId = (() => {
      try {
        return localStorage.getItem("userId") || undefined;
      } catch {
        return undefined;
      }
    })();

    const isPwa =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;

    const payload = {
      path: path.slice(0, 500),
      referrer: document.referrer || undefined,
      visitorId,
      userId,
      isPwa,
    };

    const headers = {
      "Content-Type": "application/json",
    };

    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon("/api/page-view", JSON.stringify(payload));
      } catch {
        // ignore beacon failures
      }
    } else {
      fetch("/api/page-view", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
