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

    if (typeof window.aclib !== "undefined") {
      runAd();
    } else {
      // Wait for the global aclib script to finish loading
      const interval = setInterval(() => {
        if (typeof window.aclib !== "undefined") {
          clearInterval(interval);
          runAd();
        }
      }, 500);
      
      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }
  }, [zoneId]);

  return (
    <div 
      ref={bannerRef} 
      className="adcash-banner-container" 
      style={{ textAlign: "center", margin: "16px auto", minHeight: "90px", display: "flex", justifyContent: "center" }} 
    />
  );
}
