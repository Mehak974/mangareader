"use client";

import { useEffect, useState, useRef } from "react";

const PROVIDER_SCRIPT = "https://a.magsrv.com/ad-provider.js";
const DESKTOP_CLASS = "eas6a97888e2";
const DESKTOP_ZONEID = "5990958";
const MOBILE_CLASS = "eas6a97888e10";
const MOBILE_ZONEID = "5991066";

let providerLoaded = false;

export default function AdManager() {
  const [isMobile, setIsMobile] = useState(false);
  const insRef = useRef(null);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  useEffect(() => {
    if (providerLoaded) {
      if (insRef.current) {
        (window.AdProvider = window.AdProvider || []).push({ "serve": {} });
      }
      return;
    }
    providerLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.type = "application/javascript";
    script.src = PROVIDER_SCRIPT;
    script.onload = () => {
      (window.AdProvider = window.AdProvider || []).push({ "serve": {} });
    };
    script.onerror = () => {
      providerLoaded = false;
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (insRef.current && providerLoaded) {
      (window.AdProvider = window.AdProvider || []).push({ "serve": {} });
    }
  }, [isMobile]);

  return (
    <div className="ad-banner-wrapper">
      <ins
        ref={insRef}
        className={isMobile ? MOBILE_CLASS : DESKTOP_CLASS}
        data-zoneid={isMobile ? MOBILE_ZONEID : DESKTOP_ZONEID}
      />
    </div>
  );
}
