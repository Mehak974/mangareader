"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AdCashBanner({ zoneId = '11874874' }) {
  const bannerRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!bannerRef.current) return;
    
    bannerRef.current.innerHTML = "";
    
    const runAd = () => {
      if (!bannerRef.current) return;
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
        // Removed aclib.js injection as requested to stop onclick popovers
        // const script = document.createElement("script");
        // script.id = "aclib";
        // script.type = "text/javascript";
        // script.src = "//acscdn.com/script/aclib.js";
        // document.head.appendChild(script);
        
        if (script) {
          script.onload = () => resolve();
        }
        
        const interval = setInterval(() => {
          if (typeof window.aclib !== "undefined") {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });
    };

    loadAclib().then(() => runAd());
  }, [zoneId, pathname, searchParams]);

  return (
    <div 
      ref={bannerRef} 
      className="adcash-banner-container" 
      style={{ textAlign: "center", margin: "16px auto", minHeight: "90px", display: "flex", justifyContent: "center" }} 
    />
  );
}
