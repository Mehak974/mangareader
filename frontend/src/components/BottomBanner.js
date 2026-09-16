"use client";

import { useState, useEffect } from "react";

export default function BottomBanner() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      id="frame"
      style={{
        width: isMobile ? "50%" : "20%",
        margin: "auto",
        position: "relative",
        zIndex: 99998,
      }}
    >
      <iframe
        data-aa="2455518"
        src="//acceptable.a-ads.com/2455518/?size=Adaptive"
        style={{
          border: 0,
          padding: 0,
          width: "70%",
          height: "auto",
          overflow: "hidden",
          display: "block",
          margin: "auto",
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
      />
    </div>
  );
}