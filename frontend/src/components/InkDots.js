"use client";

import React, { useEffect, useState } from "react";

export default function InkDots() {
  const [dots, setDots] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      return; // Skip rendering on mobile for performance (TBT / LCP)
    }
    const list = [];
    for (let i = 0; i < 18; i++) {
      const s = 3 + Math.random() * 5;
      const d = 10 + Math.random() * 12;
      const dl = Math.random() * 16;
      const sc = 0.6 + Math.random() * 1.2;
      list.push({
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          bottom: "-20px",
          width: `${s}px`,
          height: `${s}px`,
          "--s": sc,
          animationDuration: `${d}s`,
          animationDelay: `-${dl}s`,
        },
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDots(list);
  }, []);

  return (
    <div className="ink-dots" id="ink-dots">
      {dots.map((dot) => (
        <div key={dot.id} className="ink-dot" style={dot.style} />
      ))}
    </div>
  );
}
