"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AdCashBanner({ zoneId = '11879666' }) {
  const bannerRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!bannerRef.current) return;
    
    let refreshInterval;
    
    const runAd = () => {
      if (!bannerRef.current) return;
      bannerRef.current.innerHTML = ""; // Clear old ad
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.text = `
        try {
          aclib.runBanner({
              zoneId: '${zoneId}',
          });
        } catch(e) {}
      `;
      bannerRef.current.appendChild(script);
    };

    const loadAclib = () => {
      return new Promise((resolve) => {
        if (typeof window.aclib !== "undefined") {
          resolve();
          return;
        }
        
        let script = document.getElementById("aclib");
        
        if (!script) {
          script = document.createElement("script");
          script.id = "aclib";
          script.type = "text/javascript";
          script.src = "//acscdn.com/script/aclib.js";
          document.head.appendChild(script);
        }
        
        script.onload = () => resolve();
        
        const interval = setInterval(() => {
          if (typeof window.aclib !== "undefined") {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });
    };

    loadAclib().then(() => {
      runAd();
      
      // Auto-refresh the ad every 60 seconds (60000 ms) so readers see new ads while spending 5 mins on a chapter
      refreshInterval = setInterval(() => {
        runAd();
      }, 60000);
    });
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [zoneId, pathname, searchParams]);

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center", margin: "20px 0" }}>
      <div 
        ref={bannerRef}
        style={{ 
          minWidth: "300px", 
          minHeight: "60px", 
          background: "rgba(0,0,0,0.1)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      />
    </div>
  );
}
