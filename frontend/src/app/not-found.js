"use client";

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
      padding: '20px',
      color: 'var(--text)'
    }}>
      <h1 style={{ fontSize: '100px', fontWeight: 'bold', margin: '0', color: 'var(--accent)' }}>404</h1>
      <h2 style={{ fontSize: '24px', margin: '0 0 20px', color: 'var(--text)' }}>This page could not be found.</h2>
      <p style={{ color: 'var(--text2)', marginBottom: '30px', maxWidth: '400px', lineHeight: '1.5' }}>
        Oops! The manga or page you're looking for seems to have vanished into another world.
      </p>
      <Link 
        href="/"
        style={{
          padding: '12px 24px',
          background: 'var(--accent)',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          border: 'none',
          boxShadow: '0 4px 14px 0 rgba(168, 85, 247, 0.39)'
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.5)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 14px 0 rgba(168, 85, 247, 0.39)';
        }}
      >
        Return to Home
      </Link>
    </div>
  );
}
