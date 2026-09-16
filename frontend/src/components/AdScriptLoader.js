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

    const script = document.createElement("script");
    script.src = "/popunder.js";
    script.async = true;
    script.referrerPolicy = "no-referrer-when-downgrade";
    document.body.appendChild(script);

    return () => {
      script.remove();
      loaded.current = false;
    };
  }, [pathname]);

  return null;
}