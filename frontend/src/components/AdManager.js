"use client";

import { useEffect } from "react";

export default function AdManager() {
  useEffect(() => {
    fetch("/ads.js")
      .then((res) => res.text())
      .then((text) => {
        const container = document.createElement("div");
        container.innerHTML = text;
        const adScript = container.querySelector("script");
        if (adScript) {
          document.head.appendChild(adScript);
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
