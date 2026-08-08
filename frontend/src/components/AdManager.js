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
  const containerRef = useRef(null);

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
    if (!mounted) return;

    const loadAd = () => {
      if (!containerRef.current) return;
      
      // Clear container to prevent duplicate ads on re-renders
      containerRef.current.innerHTML = '';

      // Create the <ins> tag natively so ExoClick can manipulate it without React conflicts
      const ins = document.createElement('ins');
      ins.className = isMobile ? MOBILE_CLASS : DESKTOP_CLASS;
      ins.setAttribute('data-zoneid', isMobile ? MOBILE_ZONEID : DESKTOP_ZONEID);
      // Optional: Give it a minimum height to avoid layout shift
      ins.style.display = 'inline-block';
      ins.style.minHeight = isMobile ? '50px' : '90px';
      
      containerRef.current.appendChild(ins);

      // Trigger ExoClick ad load
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ serve: {} });
    };

    // Small delay ensures DOM is painted
    const timer = setTimeout(loadAd, 150);
    return () => clearTimeout(timer);
  }, [mounted, isMobile]);

  if (!mounted) return null;

  return (
    <>
      <Script
        id="magsrv-provider"
        strategy="afterInteractive"
        src={PROVIDER_SCRIPT}
      />
      <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5">
        <div ref={containerRef} className="w-full flex justify-center items-center overflow-hidden min-h-[50px] lg:min-h-[90px]">
          {/* Ad will be natively injected here */}
        </div>
      </div>
    </>
  );
}
