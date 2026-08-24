"use client";

import { useEffect } from "react";

export default function AdManager() {
  useEffect(() => {
    fetch("/ads.js")
      .then((res) => res.text())
      .then((text) => {
        const script = document.createElement("script");
        script.text = text;
        document.head.appendChild(script);
      })
      .catch(() => {});
  }, []);

  return null;
}
