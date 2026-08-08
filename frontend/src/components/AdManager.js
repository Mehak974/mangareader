"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const PROVIDER_SCRIPT = "https://a.magsrv.com/ad-provider.js";

const ExoAd = ({ zoneId, className }) => {
  useEffect(() => {
    // Delay ensures <ins> tag is in DOM before push is called
    const timer = setTimeout(() => {
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ serve: {} });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Standard React rendering. ExoClick handles injecting into this tag.
  return <ins className={className} data-zoneid={zoneId} style={{ display: 'inline-block', minWidth: '300px', minHeight: '50px' }}></ins>;
};

export default function AdManager() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
  }, []);

  if (!mounted) {
    return <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5 min-h-[90px]" />;
  }

  return (
    <>
      <Script
        id="magsrv-provider"
        strategy="afterInteractive"
        src={PROVIDER_SCRIPT}
      />
      <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5">
        <div className="flex justify-center items-center overflow-hidden min-h-[50px] lg:min-h-[90px]">
          {isMobile ? (
            <ExoAd zoneId="5991066" className="eas6a97888e10" />
          ) : (
            <ExoAd zoneId="5990958" className="eas6a97888e2" />
          )}
        </div>
      </div>
    </>
  );
}
