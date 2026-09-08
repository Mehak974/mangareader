"use client";

import { useEffect, useRef } from "react";

export default function AAdsBanner() {
  const ref = useRef(null);

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
      id="aads-frame"
      ref={ref}
      style={{
        width: "100%",
        margin: "0 auto",
        background: "#0A0612",
        display: "block",
        position: "relative",
      }}
    >
      <iframe
        data-aa="2454751"
        src="https://acceptable.a-ads.com/2454751/?size=Adaptive&background_color=0A0612&title_color=A855F7&title_hover_color=A855F7"
        style={{
          border: 0,
          padding: 0,
          width: "100%",
          maxWidth: "800px",
          height: "250px",
          display: "block",
          background: "#0A0612",
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
      />
    </div>
  );
}