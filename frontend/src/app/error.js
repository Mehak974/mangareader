'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);

    // If a chunk load failed (common immediately after a new deployment when
    // visitors have stale chunk hashes in memory), automatically reload once to
    // fetch the latest bundle without showing a crash screen.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Failed to load chunk') ||
      error?.message?.includes('Loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', 'true');
        window.location.reload();
        return;
      }
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '30px',
        color: '#e5e7eb',
        background: '#0a0a0c',
        fontFamily: 'sans-serif',
      }}
    >
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '12px' }}>
        Something went wrong
      </h2>
      <p style={{ color: '#9ca3af', maxWidth: '420px', marginBottom: '24px', fontSize: '0.95rem' }}>
        An update may have just been released. Please refresh the page to load the latest version.
      </p>
      <button
        onClick={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('chunk_reload');
            window.location.reload();
          } else {
            reset();
          }
        }}
        style={{
          background: '#6366f1',
          color: '#ffffff',
          border: 'none',
          padding: '10px 24px',
          borderRadius: '8px',
          fontSize: '0.95rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        Refresh Page
      </button>
    </div>
  );
}
