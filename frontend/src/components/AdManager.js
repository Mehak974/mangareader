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

      // 1. Create the main Adcash script
      const scriptTag = document.createElement("script");
      scriptTag.id = "aclib";
      scriptTag.type = "text/javascript";
      scriptTag.src = "https://acscdn.com/script/aclib.js";
      
      // 2. Create the trigger script
      const triggerTag = document.createElement("script");
      triggerTag.type = "text/javascript";
      triggerTag.innerHTML = `
        if (typeof aclib !== 'undefined') {
            aclib.runBanner({ zoneId: '11931906' });
        }
      `;

      // We wait for the main script to load before injecting the trigger
      // This ensures 'aclib' is defined and the banner injects in the correct place
      scriptTag.onload = () => {
         if (containerRef.current) {
             containerRef.current.appendChild(triggerTag);
         }
      };

      containerRef.current.appendChild(scriptTag);
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
