"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function AAdsBanner() {
  const ref = useRef(null);
  const pathname = usePathname();
  const [key, setKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setKey((k) => k + 1);
  }, [pathname]);

  useEffect(() => {
    const handler = (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const h = data?.height || data?.h;
        const iframe = ref.current?.querySelector("iframe");
        if (iframe && h) iframe.style.height = `${h}px`;
      } catch {
        // ignore non-json messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div
      id="frame"
      ref={ref}
      style={{
        width: isMobile ? "50%" : "20%",
        margin: "auto",
        position: "relative",
        zIndex: 99998,
      }}
    >
      <iframe
        key={key}
        data-aa="2454751"
        src="//acceptable.a-ads.com/2454751/?size=Adaptive"
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