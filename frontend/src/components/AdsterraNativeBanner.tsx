'use client';

import { useEffect, useRef, useState } from 'react';

const CONTAINER_ID = 'container-ff33caa520bbf15b345486697ce9e67c';
const SCRIPT_SRC = 'https://bauval.org/21/ff33caa520bbf15b345486697ce9e67c';

interface AdsterraNativeBannerProps {
  style?: React.CSSProperties;
}

export default function AdsterraNativeBanner({ style }: AdsterraNativeBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const hostname = window.location.hostname.toLowerCase();
    // Only load for mangareader.pro (and localhost for testing)
    const isAllowed = hostname.includes('mangareader.pro') || hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isAllowed) return;

    // Re-inject script on mount/chapter change so Adsterra populates the container
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      try { existing.remove(); } catch {}
    }

    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = SCRIPT_SRC;
    document.head.appendChild(s);

    return () => {
      try { s.remove(); } catch {}
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className="adsterra-native-banner"
      style={{
        width: '100%',
        maxWidth: '728px',
        margin: '20px auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '90px',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div id={CONTAINER_ID} style={{ width: '100%', minHeight: '90px' }} />
    </div>
  );
}
