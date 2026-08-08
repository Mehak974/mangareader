"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AdManager() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef(null);
  const pathname = usePathname(); // Tracks route changes

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    // Clear previous ad content to prevent duplicates on React re-renders
    containerRef.current.innerHTML = "";

    const zoneId = isMobile ? "5991066" : "5990958";
    const className = isMobile ? "eas6a97888e10" : "eas6a97888e2";

    // 1. Inject the Asynchronous AdProvider script
    const scriptTag = document.createElement("script");
    scriptTag.src = "https://a.magsrv.com/ad-provider.js";
    scriptTag.async = true;
    scriptTag.type = "application/javascript";
    
    // 2. Inject the <ins> tag
    const insTag = document.createElement("ins");
    insTag.className = className;
    insTag.setAttribute("data-zoneid", zoneId);
    
    // Some ad providers require inline-block to calculate dimensions properly
    insTag.style.display = "inline-block";

    // 3. Inject the inline trigger script (Exactly as ExoClick provides it)
    const triggerTag = document.createElement("script");
    triggerTag.type = "text/javascript";
    triggerTag.innerHTML = `(window.AdProvider = window.AdProvider || []).push({"serve": {}});`;

    // Append everything directly to the DOM natively
    containerRef.current.appendChild(scriptTag);
    containerRef.current.appendChild(insTag);
    containerRef.current.appendChild(triggerTag);

  }, [mounted, isMobile, pathname]); // Re-run whenever the route (pathname) changes

  return (
    <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5">
      <div 
        ref={containerRef} 
        className="w-full flex justify-center items-center min-h-[50px] lg:min-h-[90px]"
      />
    </div>
  );
}
