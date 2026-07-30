"use client";
import { useState, useEffect } from "react";
import { onAchievement } from "@/utils/achievements";

export default function AchievementToast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const off = onAchievement((ach) => {
      setQueue((q) => [...q, { ...ach, key: Date.now() }]);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
      const t = setTimeout(() => setCurrent(null), 3500);
      return () => clearTimeout(t);
    }
  }, [current, queue]);

  if (!current) return null;

  return (
    <div className="achievement-toast" role="alert" aria-live="polite">
      <div className="achievement-icon">{current.icon}</div>
      <div>
        <div className="achievement-label">Achievement Unlocked</div>
        <div className="achievement-title">{current.title}</div>
        <div className="achievement-desc">{current.desc}</div>
      </div>
    </div>
  );
}
