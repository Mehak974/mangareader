"use client";

import { useEffect } from "react";

export default function AdManager() {
  useEffect(() => {
    let mounted = true;

    const loadAds = async () => {
      try {
        const res = await fetch("/ads.js", { cache: "no-store" });
        if (!res.ok) throw new Error(`ads.js fetch failed: ${res.status}`);
        const text = await res.text();
        if (!mounted) return;

        const jsonMatch = text.match(/\(\s*(\{[\s\S]*\})\s*\)/);
        if (!jsonMatch) throw new Error("No PopAds options JSON found");

        let options;
        try {
          options = JSON.parse(jsonMatch[1]);
        } catch {
          options = {};
        }

        const scriptUrl = options?.scriptSrc;
        if (!scriptUrl) throw new Error("No scriptSrc in PopAds options");

        const resolvedUrl = scriptUrl.startsWith("//")
          ? `${location.protocol}${scriptUrl}`
          : scriptUrl;

        if (process.env.NODE_ENV !== "production") {
          console.log("[AdManager] Loading PopAds script:", resolvedUrl);
        }

        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = resolvedUrl;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`PopAds script load failed: ${resolvedUrl}`));
          document.head.appendChild(script);
        });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[AdManager]", err);
        }
      }
    };

    loadAds();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
