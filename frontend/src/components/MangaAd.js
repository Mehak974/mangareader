"use client";

import React, { useEffect, useState, useRef } from 'react';

const DESKTOP_ZONE = "11461253";
const DESKTOP_SRC = "https://nap5k.com/tag.min.js";

const MOBILE_ZONE = "11533092";
const MOBILE_SRC = "https://al5sm.com/tag.min.js";

const REFRESH_INTERVAL = 120000;
const GHOST_DELAY = 10000;
const GHOST_OPACITY = "0.1";

export default function MangaAd() {
  const [isMobile, setIsMobile] = useState(false);
  const [opacity, setOpacity] = useState("1");
  const [pointerEvents, setPointerEvents] = useState("auto");
  const [isDismissed, setIsDismissed] = useState(false);
  const [transform, setTransform] = useState("translateX(0)");
  const containerRef = useRef(null);
  const timerLoopRef = useRef(null);
  const timerGhostRef = useRef(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const popunderFiredRef = useRef(false);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const firePopunder = () => {
      if (popunderFiredRef.current) return;
      popunderFiredRef.current = true;

      const script = document.createElement('script');
      script.dataset.zone = MOBILE_ZONE;
      script.src = MOBILE_SRC;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      (document.documentElement || document.body).appendChild(script);

      document.removeEventListener('click', firePopunder, true);
      document.removeEventListener('touchstart', firePopunder, true);
    };

    document.addEventListener('click', firePopunder, true);
    document.addEventListener('touchstart', firePopunder, true);

    return () => {
      document.removeEventListener('click', firePopunder, true);
      document.removeEventListener('touchstart', firePopunder, true);
    };
  }, [isMobile]);

  const loadFreshAd = () => {
    if (isDismissed || document.hidden || !containerRef.current) return;

    setOpacity("1");
    setPointerEvents("auto");

    const container = containerRef.current;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = DESKTOP_SRC;
    script.dataset.zone = DESKTOP_ZONE;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    container.appendChild(script);

    if (timerGhostRef.current) clearTimeout(timerGhostRef.current);
    timerGhostRef.current = setTimeout(() => {
      setOpacity(GHOST_OPACITY);
      setPointerEvents("none");
    }, GHOST_DELAY);
  };

  useEffect(() => {
    if (isMobile) return;

    loadFreshAd();
    timerLoopRef.current = setInterval(loadFreshAd, REFRESH_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timerLoopRef.current);
        if (timerGhostRef.current) clearTimeout(timerGhostRef.current);
      } else {
        timerLoopRef.current = setInterval(loadFreshAd, REFRESH_INTERVAL);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerLoopRef.current);
      clearTimeout(timerGhostRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMobile, isDismissed]);

  const hardDismissAd = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsDismissed(true);
    clearInterval(timerLoopRef.current);
    clearTimeout(timerGhostRef.current);
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStart.current = {
        x: e.touches[0].screenX,
        y: e.touches[0].screenY,
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      const deltaX = e.changedTouches[0].screenX - touchStart.current.x;
      const deltaY = e.changedTouches[0].screenY - touchStart.current.y;

      if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 40) {
        setTransform(`translateX(${deltaX > 0 ? '160%' : '-160%'})`);
        setOpacity("0");
        setTimeout(() => {
          hardDismissAd(null);
        }, 300);
      }
    }
  };

  if (isMobile || isDismissed) return null;

  return (
    <div
      id="manga-ad-wrapper"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        bottom: '15px',
        left: '15px',
        zIndex: 99999,
        width: '92%',
        maxWidth: '360px',
        height: '110px',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        borderRadius: '12px',
        opacity: opacity,
        transform: transform,
        pointerEvents: pointerEvents,
        transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.1, 0.8, 0.3, 1)',
        touchAction: 'none',
      }}
    >
      <button
        onClick={hardDismissAd}
        style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          zIndex: 100000,
          background: '#e74c3c',
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: '50%',
          width: '26px',
          height: '26px',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '13px',
          lineHeight: '22px',
          textAlign: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          pointerEvents: 'auto'
        }}
      >
        X
      </button>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
    </div>
  );
}
