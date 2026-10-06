"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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
    }
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}
