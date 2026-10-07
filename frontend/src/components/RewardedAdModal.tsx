'use client';

import React, { useState, useEffect, useRef } from 'react';
import { HILLTOP_DIRECT_LINK, AD_CONFIG } from '@/lib/site-config';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReward: () => void;
  chapterTitle?: string;
  packProgress?: { percent: number; text: string } | null;
}

export default function RewardedAdModal({
  isOpen,
  onClose,
  onReward,
  chapterTitle = 'Chapter',
  packProgress,
}: RewardedAdModalProps) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [videoSrc, setVideoSrc] = useState<string>('/videos/sponsor-ad.mp4');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [clickThrough, setClickThrough] = useState<string | null>(HILLTOP_DIRECT_LINK);

  const trackingFiredRef = useRef(false);
  const impressionFiredRef = useRef(false);
  const completeFiredRef = useRef(false);
  const adDataRef = useRef<{ impressionUrls?: string[]; trackingUrls?: Record<string, string[]> } | null>(null);
  const beaconCacheRef = useRef<HTMLImageElement[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fireBeacons = (urls?: string[]) => {
    if (!Array.isArray(urls) || !urls.length) return;

    // 1. Direct browser firing (sendBeacon / fetch keepalive)
    urls.forEach((url) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(url);
        } else {
          fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true }).catch(() => {});
        }
      } catch {}
      // Keep reference in ref array so browser doesn't GC in-flight image requests
      try {
        const img = new Image();
        img.src = url;
        beaconCacheRef.current.push(img);
      } catch {}
    });

    // 2. Server-side proxy beacon (guarantees delivery even if user has an ad blocker)
    try {
      fetch('/api/sponsor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  const handleVideoPlaybackStarted = () => {
    if (impressionFiredRef.current) return;
    impressionFiredRef.current = true;

    const imps = adDataRef.current?.impressionUrls || [];
    const starts = adDataRef.current?.trackingUrls?.start || [];
    const allStartBeacons = Array.from(new Set([...imps, ...starts]));
    fireBeacons(allStartBeacons);
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state on modal close
      setTimeLeft(15);
      setVideoSrc('/videos/sponsor-ad.mp4');
      setIsLoadingVideo(false);
      setAutoplayBlocked(false);
      setIsCompleted(false);
      trackingFiredRef.current = false;
      impressionFiredRef.current = false;
      completeFiredRef.current = false;
      adDataRef.current = null;
      beaconCacheRef.current = [];
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let isCancelled = false;

    // Load sponsor VAST video ad via ad-blocker safe endpoint
    async function loadSponsorAd() {
      try {
        let res = await fetch('/api/sponsor/reward').catch(() => null);
        if (!res || !res.ok) {
          res = await fetch('/api/ads/vast').catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          if (!isCancelled && data.success && data.videoUrl) {
            setVideoSrc(data.videoUrl);
            if (data.clickThrough) {
              setClickThrough(data.clickThrough);
            }
            adDataRef.current = {
              impressionUrls: data.impressionUrls || [],
              trackingUrls: data.trackingUrls || {},
            };
          }
        }
      } catch (err) {
        console.warn('Sponsor video ad error:', err);
      }
    }

    loadSponsorAd();

    // 15-second sponsor countdown
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isCancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // Autoplay video reliably once videoSrc is ready
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      const v = videoRef.current;
      v.muted = true;
      v.defaultMuted = true;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setAutoplayBlocked(false);
            handleVideoPlaybackStarted();
          })
          .catch((err) => {
            console.warn('Autoplay prevented by browser:', err?.name);
            if (err?.name === 'NotSupportedError' && videoSrc !== '/videos/sponsor-ad.mp4') {
              setVideoSrc('/videos/sponsor-ad.mp4');
            } else {
              setAutoplayBlocked(true);
            }
          });
      }
    }
  }, [videoSrc]);

  // When timer hits 0 or video ends
  useEffect(() => {
    if (isCompleted && !trackingFiredRef.current) {
      trackingFiredRef.current = true;
      if (!completeFiredRef.current) {
        completeFiredRef.current = true;
        const completes = adDataRef.current?.trackingUrls?.complete || [];
        fireBeacons(completes);
      }
      onReward();
    }
  }, [isCompleted, onReward]);

  const handleManualPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().then(() => {
        setAutoplayBlocked(false);
      }).catch(() => {});
    }
  };

  const handleVideoClick = () => {
    const target = clickThrough || HILLTOP_DIRECT_LINK;
    if (target && typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 3, 10, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, #160c29 0%, #0c0617 100%)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Sponsored Download
            </span>
            <span style={{ fontSize: '13px', color: '#e9d5ff', fontWeight: 600 }}>
              {chapterTitle}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
            title="Cancel"
            aria-label="Cancel download"
          >
            ✕
          </button>
        </div>

        {/* Video / Sponsor Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            background: '#07030e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              cursor: 'pointer',
            }}
            onClick={handleVideoClick}
            title="Click to visit sponsor"
          >
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              playsInline
              muted={isMuted}
              onPlay={handleVideoPlaybackStarted}
              onError={() => {
                if (videoSrc !== '/videos/sponsor-ad.mp4') {
                  setVideoSrc('/videos/sponsor-ad.mp4');
                }
              }}
              onEnded={() => setIsCompleted(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Autoplay blocked play button */}
            {autoplayBlocked && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={handleManualPlay}
              >
                <button
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 18px',
                    borderRadius: '30px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(168,85,247,0.5)',
                  }}
                >
                  ▶ Watch Sponsor Video
                </button>
              </div>
            )}

            {/* Mute/Unmute toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  const newMuted = !isMuted;
                  videoRef.current.muted = newMuted;
                  setIsMuted(newMuted);
                }
              }}
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                zIndex: 2,
              }}
            >
              {isMuted ? '🔇 Unmute' : '🔊 Sound On'}
            </button>

            {/* Sponsor Watermark */}
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(0,0,0,0.6)',
                color: 'rgba(255,255,255,0.8)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                zIndex: 2,
              }}
            >
              Sponsored Video ↗
            </div>
          </div>

          {/* Countdown Badge */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'rgba(0, 0, 0, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 3,
            }}
          >
            {isCompleted ? (
              <span style={{ color: '#4ade80' }}>✓ Unlocked</span>
            ) : (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#f43f5e',
                  }}
                />
                Download unlocks in {timeLeft}s
              </>
            )}
          </div>
        </div>

        {/* Bottom Status & Progress */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: isCompleted
                  ? '100%'
                  : `${Math.max(
                      Math.round(((15 - timeLeft) / 15) * 100),
                      packProgress?.percent || 0
                    )}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
              {isCompleted
                ? '🎉 Chapter ready! Saved offline for 24 hours (0 data used).'
                : packProgress?.text || `Packing offline pages... (${timeLeft}s remaining)`}
            </span>
            <span style={{ color: '#c084fc', fontWeight: 600 }}>
              {isCompleted ? '100%' : `${Math.round(((15 - timeLeft) / 15) * 100)}%`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
            <a
              href={clickThrough || HILLTOP_DIRECT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#c084fc',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Visit Sponsor ↗
            </a>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Offline for 24h · 15s Video Reward
            </span>
          </div>

          {/* Action button */}
          {isCompleted && (
            <button
              onClick={onClose}
              style={{
                marginTop: '4px',
                padding: '10px',
                background: 'var(--accent, #a855f7)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Done / Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
