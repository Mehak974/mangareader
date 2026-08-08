"use client";

import Script from "next/script";
import { useEffect, useState, useRef } from "react";

const PROVIDER_SCRIPT = "https://a.magsrv.com/ad-provider.js";
const DESKTOP_CLASS = "eas6a97888e2";
const DESKTOP_ZONEID = "5990958";
const MOBILE_CLASS = "eas6a97888e10";
const MOBILE_ZONEID = "5991066";

export default function AdManager() {
  const [isMobile, setIsMobile] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const insRef = useRef(null);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!insRef.current) return;
    if (isScriptLoaded) {
      (window.AdProvider = window.AdProvider || []).push({ "serve": {} });
    }
  }, [isMobile, isScriptLoaded]);

  return (
    <>
      <Script
        id="magsrv-provider"
        strategy="afterInteractive"
        src={PROVIDER_SCRIPT}
        onLoad={() => setIsScriptLoaded(true)}
      />
      <div className="ad-banner-wrapper">
        <ins
          ref={insRef}
          className={isMobile ? MOBILE_CLASS : DESKTOP_CLASS}
          data-zoneid={isMobile ? MOBILE_ZONEID : DESKTOP_ZONEID}
        />
      </div>
    </>
  );
}
