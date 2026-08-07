"use client";

import { useEffect } from "react";

export default function UserActiveTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer;

    const ping = () => {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      fetch("/api/auth/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        keepalive: true,
      }).catch(() => {});
    };

    const schedule = () => {
      timer = setTimeout(() => {
        ping();
        schedule();
      }, 30_000);
    };

    ping();
    schedule();

    const onActivity = () => {
      ping();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, []);

  return null;
}
