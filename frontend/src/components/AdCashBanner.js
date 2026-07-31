"use client";

import { useEffect, useRef } from "react";

export default function AdCashBanner({ zoneId = '11874874' }) {
  const bannerRef = useRef(null);

  useEffect(() => {
    if (!bannerRef.current) return;
    
    // Clear container to prevent duplicate ads
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
        
        let script = document.getElementById("aclib-script");
        if (!script) {
          script = document.createElement("script");
          script.id = "aclib-script";
          script.src = "//acscdn.com/script/aclib.js";
          script.type = "text/javascript";
          document.head.appendChild(script);
        }
        
        script.onload = () => resolve();
        
        // Polling fallback
        const interval = setInterval(() => {
          if (typeof window.aclib !== "undefined") {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });
    };

    loadAclib().then(() => runAd());
  }, [zoneId]);

  return (
    <div 
      ref={bannerRef} 
      className="adcash-banner-container" 
      style={{ textAlign: "center", margin: "16px auto", minHeight: "90px", display: "flex", justifyContent: "center" }} 
    />
  );
}
