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
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => window.innerWidth < 768;
    setIsMobile(checkMobile());

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setIsMobile(checkMobile());
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mounted || dismissed) return;

    // Trigger ExoClick ad load
    const loadAd = () => {
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ serve: {} });
    };

    // Small delay ensures DOM is painted before AdProvider tries to find the <ins> tag
    const timer = setTimeout(loadAd, 300);
    return () => clearTimeout(timer);
  }, [mounted, isMobile, dismissed]);

  if (!mounted || dismissed) return null;

  return (
    <>
      <Script
        id="magsrv-provider"
        strategy="afterInteractive"
        src={PROVIDER_SCRIPT}
      />
      <div className="fixed bottom-0 left-0 w-full z-[99999] flex flex-col items-center bg-black/90 pb-2 pt-2 shadow-2xl border-t border-white/10">
        <button 
          onClick={() => setDismissed(true)}
          className="absolute -top-7 right-2 bg-black/90 text-white/70 hover:text-white rounded-t-md px-3 py-1 text-xs font-bold border border-white/10 border-b-0 transition-colors"
        >
          Close X
        </button>
        
        <div className="w-full flex justify-center items-center min-h-[50px] overflow-hidden">
          {isMobile ? (
            <ins className={MOBILE_CLASS} data-zoneid={MOBILE_ZONEID} style={{ display: 'inline-block' }}></ins>
          ) : (
            <ins className={DESKTOP_CLASS} data-zoneid={DESKTOP_ZONEID} style={{ display: 'inline-block' }}></ins>
          )}
        </div>
      </div>
    </>
  );
}
