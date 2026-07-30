"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";

export default function ExoClickBanner({ zoneId = "5990958", className = "eas6a97888e2" }) {
  const adRef = useRef(false);

  useEffect(() => {
    // Only push the ad once per mount to prevent duplicates
    if (!adRef.current) {
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ serve: {} });
      adRef.current = true;
    }
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "24px 0", minHeight: "90px", width: "100%", overflow: "hidden", maxWidth: "100vw" }}>
      {/* Load ExoClick Provider script once globally */}
      <Script src="https://a.magsrv.com/ad-provider.js" strategy="afterInteractive" />
      {/* The Ad Container */}
      <ins className={className} data-zoneid={zoneId} style={{ maxWidth: "100%", overflow: "hidden" }}></ins>
    </div>
  );
}
