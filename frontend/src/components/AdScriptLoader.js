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
    script.innerHTML = `
      (function(twvsf){
        var d = document,
            s = d.createElement('script'),
            l = d.scripts[d.scripts.length - 1];
        s.settings = twvsf || {};
        s.src = "//purple-text.com/c.DI9m6_bw2t5/l/S/WzQH9tNNzrMVysMeDqUiyMOUSN0_3/M/z/IuwNNaTSMwzb";
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
      })({})
    `;
    document.body.appendChild(script);

    return () => {
      script.remove();
      loaded.current = false;
    };
  }, [pathname]);

  return null;
}
