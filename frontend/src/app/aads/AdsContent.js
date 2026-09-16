"use client";

import { useEffect, useState } from "react";

export default function AdsContent() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ width: "100%", minHeight: "100vh", margin: 0, padding: 0, background: "#0A0612" }}>
      <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: "10px", width: "100%", flexWrap: "wrap", padding: "4px 0" }}>
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
            src="//acceptable.a-ads.com/2455518/?size=Adaptive&background_color=transparent&title_color=B46CF9&title_hover_color=B46CF9&text_color=ffffff&link_color=B46CF9&link_hover_color=B46CF9"
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
          <div
            style={{
              width: "70%",
              margin: "auto",
              position: "absolute",
              left: 0,
              right: 0,
            }}
          >
            <a
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                fontSize: "13px",
                color: "#263238",
                padding: "4px 10px",
                background: "#F8F8F9",
                textDecoration: "none",
                borderRadius: "0 0 4px 4px",
              }}
              id="frame-link"
              href="https://aads.com/campaigns/new/?source_id=2455518&source_type=ad_unit&partner=2455518"
            >
              Advertise here
            </a>
          </div>
        </div>
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
            data-aa="2454751"
            src="//acceptable.a-ads.com/2454751/?size=Adaptive&background_color=transparent"
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
      </div>
    </div>
  );
}