"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Resolve CSS custom properties & dev analytics stub at runtime without injecting script tags into React tree
if (typeof window !== "undefined") {
  try {
    const h = window.location.hostname;
    const t: Record<string, { a: string; ah: string; bd: string; bc: string }> = {
      "mangaread.pro":     { a: "#38BDF8", ah: "#0EA5E9", bd: "#0C1220", bc: "#111827" },
      "manireader.online": { a: "#F97316", ah: "#EA580C", bd: "#0E0F14", bc: "#16171F" },
    };
    const c = t[h] || { a: "#A855F7", ah: "#9333EA", bd: "#0A0612", bc: "#13091E" };
    const s = document.documentElement.style;
    s.setProperty("--accent",       c.a);
    s.setProperty("--accent-hover", c.ah);
    s.setProperty("--bg-dark",      c.bd);
    s.setProperty("--bg-card",      c.bc);

    (window as any).dataLayer = (window as any).dataLayer || [];
    if (!(window as any).gtag) {
      (window as any).gtag = function () {};
    }
  } catch (_) {}
}

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track Google Analytics & Cloudflare pageviews on SPA route changes
  useEffect(() => {
    if (pathname && typeof window !== "undefined") {
      const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      const fullUrl = window.location.origin + fullPath;
      const title = typeof document !== "undefined" ? document.title : "";

      // 1. Google Analytics
      // layout.tsx init script already sent the first view (sets __gaLast); skip the duplicate
      if ((window as any).gtag && (window as any).__gaLast !== fullPath) {
        (window as any).__gaLast = fullPath;
        (window as any).gtag("event", "page_view", {
          page_location: fullUrl,
          page_path: fullPath,
          page_title: title,
        });
      }

      // 2. Cloudflare Web Analytics SPA Beacon
      if ((window as any).__cfBeacon && typeof (window as any).__cfBeacon.send === "function") {
        try {
          (window as any).__cfBeacon.send({
            type: "pageview",
            url: fullUrl,
          });
        } catch (_) {}
      }

      // 3. Umami Analytics SPA Beacon
      if (typeof (window as any).umami !== "undefined" && typeof (window as any).umami.track === "function") {
        if ((window as any).__umamiLast && (window as any).__umamiLast !== fullPath) {
          try {
            (window as any).umami.track((props: any) => ({
              ...props,
              url: fullPath,
              title: title,
            }));
          } catch (_) {}
        }
        (window as any).__umamiLast = fullPath;
      }
    }
  }, [pathname, searchParams]);

  // Active Reader Heartbeat: Keep sessions alive in Umami while reading long chapters
  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && typeof (window as any).umami?.track === "function") {
        try {
          (window as any).umami.track("heartbeat");
        } catch (_) {}
      }
    }, 120000); // Ping every 2 minutes while tab is active

    return () => clearInterval(interval);
  }, []);

  return null;
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}
