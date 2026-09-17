"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AdScriptLoader() {
  const pathname = usePathname();
  const loaded = useRef(false);

  useEffect(() => {
    if (pathname === "/aads") return;
    if (loaded.current) return;
    loaded.current = true;

    // PopAds script is now injected inline in layout.js head
    // This component kept for any future dynamic ad loading

    return () => {
      loaded.current = false;
    };
  }, [pathname]);

  return null;
}