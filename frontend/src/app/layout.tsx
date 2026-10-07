/**
 * layout.tsx — Domain-aware root layout
 *
 * Replaces src/app/layout.js
 *
 * Changes from the original:
 *  - All brand strings come from site-config.ts (name, description, OG image)
 *  - Google / Bing / Hilltop verification meta tags injected per domain
 *  - Google Font chosen per domain (DM Sans / Inter / Plus Jakarta Sans)
 *  - AAdsBanner (A-ADS) + AdScriptLoader (Hilltop) already use site-config internally
 */

import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { AppProvider }       from '@/context/AppContext';
import AnalyticsProvider   from '@/components/AnalyticsProvider';
import { Toaster }          from 'react-hot-toast';
import Header               from '@/components/Header';
import JsonLd               from '@/components/JsonLd';
import MaintenanceGuard     from '@/components/MaintenanceGuard';
import { Analytics }        from '@vercel/analytics/react';
import { SpeedInsights }    from '@vercel/speed-insights/next';
import {
  SITE_NAME, SITE_URL, SEO, AD_CONFIG,
  siteConfig,
} from '@/lib/site-config';
import { organizationSchema, websiteSchema } from '@/lib/seo';

// ── hreflang alternates between the 3 domains ──────────────────────────────────
// All three serve identical content; without these tags Google treats them as
// duplicates. x-default points to the primary (mangareader.pro).
const HREFLANG_PROFILES = ['mangareader.pro', 'mangaread.pro', 'manireader.online'];
const HREFLANG_ALTERNATES: Record<string, string> = {
  'x-default': 'https://mangareader.pro',
  'en':       'https://mangareader.pro',
  'en-US':    'https://mangareader.pro',
  'en-GB':    'https://mangareader.pro',
};
for (const profile of HREFLANG_PROFILES) {
  HREFLANG_ALTERNATES[profile] = `https://${profile}`;
}

// ── Google Font per domain ────────────────────────────────────────────────────
import { DM_Sans, Inter, Plus_Jakarta_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const FONT_MAP: Record<string, { variable: string; className: string }> = {
  'DM Sans':            dmSans,
  'Inter':              inter,
  'Plus Jakarta Sans':  plusJakarta,
};
const activeFont = FONT_MAP[siteConfig.theme.fontFamily] ?? dmSans;

// ── Dynamic components ────────────────────────────────────────────────────────
const Sidebar         = dynamic(() => import('@/components/Sidebar'));
const MobileNav       = dynamic(() => import('@/components/MobileNav'));
const InkDots         = dynamic(() => import('@/components/InkDots'));
const AchievementToast= dynamic(() => import('@/components/AchievementToast'));
const PWAInstall      = dynamic(() => import('@/components/PWAInstall'));
const LibraryPicker   = dynamic(() => import('@/components/LibraryPicker'));
const AAdsBanner      = dynamic(() => import('@/components/AAdsBanner'));
const AdScriptLoader  = dynamic(() => import('@/components/AdScriptLoader'));
const FeatureBroadcast = dynamic(() => import('@/components/FeatureBroadcast'));

// ── Root metadata ─────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  SEO.title,
    template: `%s | ${SITE_NAME}`,
  },
  description: SEO.description,
  keywords:    SEO.keywords,
  applicationName: SITE_NAME,

  // Google / Bing site verification — set per domain in Vercel env vars
  verification: {
    google: AD_CONFIG.googleVerification || undefined,
    other: {
      ...(AD_CONFIG.bingVerification ? { 'msvalidate.01': AD_CONFIG.bingVerification } : {}),
      ...(AD_CONFIG.hilltopVerification ? { hltp: AD_CONFIG.hilltopVerification } : {}),
    },
  },

  openGraph: {
    type:      'website',
    url:       SITE_URL,
    siteName:  SITE_NAME,
    title:     SEO.title,
    description: SEO.description,
    images: [{ url: SEO.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card:        'summary_large_image',
    site:        `@${SEO.twitterHandle}`,
    title:       SEO.title,
    description: SEO.description,
    images:      [SEO.ogImage],
  },

  alternates: {
    canonical: '/',
    languages: HREFLANG_ALTERNATES,
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:              true,
      follow:             true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  manifest: '/manifest.json',
  icons: {
    icon:  [{ url: '/icon.png' }],
    apple: [{ url: '/apple-icon.png' }],
  },
};

// ── Layout ────────────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${activeFont.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Ad network preconnects to eliminate popunder initialization delay (<5-10s) */}
        <link rel="dns-prefetch" href="//purple-text.com" />
        <link rel="preconnect" href="https://purple-text.com" />
        <link rel="dns-prefetch" href="//untimely-promotion.com" />
        <link rel="dns-prefetch" href="//elderly-craft.com" />

        {/* Structured data */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />

        {/* CSS custom properties — statically rendered to prevent flash of unstyled content */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --accent: ${siteConfig.theme.accentColor};
            --accent-hover: ${siteConfig.theme.accentHover};
            --bg-dark: ${siteConfig.theme.bgDark};
            --bg-card: ${siteConfig.theme.bgCard};
          }
        `}} />
      </head>

      <body className={`${activeFont.className} antialiased`} suppressHydrationWarning>
        {/* Google Analytics 4 (Production only — avoids localhost connection refused on port 80) */}
        {process.env.NODE_ENV === 'production' && (() => {
          const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-XX0H13PM0H';
          return (
            <>
              <Script
                src={`/a/s.js?id=${gaId}`}
                strategy="lazyOnload"
              />
              <Script
                id="gtag-init"
                strategy="lazyOnload"
              >
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', {
                    send_page_view: false,
                    transport_url: location.origin + '/a',
                    first_party_collection: true,
                  });
                  window.__gaLast = location.pathname + location.search;
                  gtag('event', 'page_view', {
                    page_location: window.location.href,
                    page_title: document.title,
                  });
                `}
              </Script>
            </>
          );
        })()}

        {/* Umami Analytics (Self-Hosted on Railway) */}
        <Script
          src="https://umami-production-f50d.up.railway.app/script.js"
          data-website-id="21b5b514-456a-478b-ab8d-f0931ca7b250"
          strategy="beforeInteractive"
        />

        {/* Cloudflare Web Analytics (Production only — avoids CORS errors on localhost:3000) */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "3d1e523ea68c46bc8be8ad71ac5a0a6c", "spa": true}'
            strategy="lazyOnload"
          />
        )}
        <AppProvider>
          <MaintenanceGuard>
            <Header />
            <Sidebar />
            <MobileNav />
            <InkDots />
            <AchievementToast />
            <PWAInstall />
            <LibraryPicker />
            <FeatureBroadcast />

            {/* Hilltop script (purple-text.com) — domain-specific */}
            <AdScriptLoader />

            {/* A-ADS banner (domain-specific unit ID + colors) — top banner for non-reader pages */}
            <AAdsBanner hideOnReader />

            <main>{children}</main>

            <Toaster position="bottom-right" />
          </MaintenanceGuard>
        </AppProvider>

        <AnalyticsProvider />
      </body>
    </html>
  );
}
