"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";

export default function ExoClickBanner() {
  const adRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only push the ad once per mount to prevent duplicates, and only after hydration
    if (mounted && !adRef.current) {
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ serve: {} });
      adRef.current = true;
    }
  }, [mounted]);

  if (!mounted) {
    return <div style={{ minHeight: "90px", width: "100%", margin: "24px 0" }}></div>;
  }

  const zoneId = isMobile ? "5991066" : "5990958";
  const className = isMobile ? "eas6a97888e10" : "eas6a97888e2";

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "24px 0", minHeight: "90px", width: "100%", overflow: "hidden", maxWidth: "100vw" }}>
      {/* Load ExoClick Provider script once globally */}
      <Script src="https://a.magsrv.com/ad-provider.js" strategy="afterInteractive" />
      {/* The Ad Container */}
      <ins className={className} data-zoneid={zoneId} style={{ maxWidth: "100%", overflow: "hidden" }}></ins>
    </div>
  );
}
