"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdScripts() {
  const pathname = usePathname();
  const isAads = pathname === "/aads";

  useEffect(() => {
    if (isAads) return;
    const adsPath = "/ads.js";
    const s = document.createElement("script");
    s.src = adsPath;
    s.async = true;
    s.referrerPolicy = "no-referrer-when-downgrade";
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, [isAads]);

  if (isAads) return null;

  return (
    <>
      <meta name="popads-verification-3664867" content="557f27c1e5809a5da647c2f8f236ef13" />
      <meta name="admaven-placement" content="BpdY8rjsF" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
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
          `,
        }}
      />
    </>
  );
}
