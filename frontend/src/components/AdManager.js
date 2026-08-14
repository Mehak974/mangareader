"use client";

import { useEffect } from "react";

export default function AdManager() {
  useEffect(() => {
    const script = document.createElement("script");
    script.text = `(function(iib){var d = document,s = d.createElement('script'),l = d.scripts[d.scripts.length - 1];s.settings = iib || {};s.src = "\\/\\/expensive-pollution.com\\/csD.9-6MbC2B5OlRSHWhQH9pN\\/zvMTyIMDD\\/UjyiOqSz0\\/3TMQzaILwqNWT\\/Mizk";s.async = true;s.referrerPolicy = 'no-referrer-when-downgrade';l.parentNode.insertBefore(s, l);})({})`;
    document.head.appendChild(script);
  }, []);

  return null;
}
