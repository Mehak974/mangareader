"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AdManager() {
  const containerRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!containerRef.current) return;

    const loadAd = () => {
      if (!containerRef.current) return;
      
      // Clear previous ad content to prevent duplicates on route changes
      containerRef.current.innerHTML = "";

      // 1. Ensure the main Adcash script is loaded globally exactly ONCE
      if (!document.querySelector('script[id="aclib"]')) {
        const scriptTag = document.createElement("script");
        scriptTag.id = "aclib";
        scriptTag.type = "text/javascript";
        scriptTag.src = "https://acscdn.com/script/aclib.js";
        scriptTag.async = true;
        document.head.appendChild(scriptTag);
      }
      
      // 2. Create the trigger script
      const triggerTag = document.createElement("script");
      triggerTag.type = "text/javascript";
      
      // We use a small polling mechanism to wait for aclib to become available
      // because the global script might still be downloading
      triggerTag.innerHTML = `
        var checkAclib = setInterval(function() {
          if (typeof aclib !== 'undefined') {
            clearInterval(checkAclib);
            try {
                aclib.runBanner({ zoneId: '11931906' });
            } catch (e) {
                console.error("Adcash Error:", e);
            }
          }
        }, 100);
      `;

      // Inject the trigger directly where the ad should appear
      containerRef.current.appendChild(triggerTag);
    };

    // Load ad immediately on mount/navigation
    loadAd();

    // Auto-reload the ad every 2 minutes (120,000 ms)
    const intervalId = setInterval(loadAd, 120000);

    // Cleanup interval on route change
    return () => clearInterval(intervalId);
  }, [pathname]); // Re-run whenever the route (pathname) changes

  return (
    <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5">
      <div 
        ref={containerRef} 
        className="w-full flex justify-center items-center min-h-[50px] lg:min-h-[90px]"
      />
    </div>
  );
}
