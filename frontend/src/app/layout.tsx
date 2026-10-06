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
      suppressHydrationWarning
    >
      <head>
        {/* CSS custom properties — resolved at runtime by hostname */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var h = location.hostname;
            var t = {
              'mangaread.pro':      { a:'#38BDF8', ah:'#0EA5E9', bd:'#0C1220', bc:'#111827' },
              'manireader.online':  { a:'#F97316', ah:'#EA580C', bd:'#0E0F14', bc:'#16171F' },
            };
            var c = t[h] || { a:'#A855F7', ah:'#9333EA', bd:'#0A0612', bc:'#13091E' };
            var s = document.documentElement.style;
            s.setProperty('--accent',       c.a);
            s.setProperty('--accent-hover', c.ah);
            s.setProperty('--bg-dark',      c.bd);
            s.setProperty('--bg-card',      c.bc);
          })();
        `}} />

        {/* Google Analytics 4 */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`/a/s.js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="gtag-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                    send_page_view: false,
                    transport_url: location.origin + '/a',
                    first_party_collection: true,
                  });
                  window.__gaLast = location.pathname + location.search;
                  gtag('event', 'page_view', {
                    page_location: window.location.href,
                    page_title: document.title,
                  });
                `,
              }}
            />
          </>
        )}

        {/* Cloudflare Web Analytics */}
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "3d1e523ea68c46bc8be8ad71ac5a0a6c", "spa": true}'
          strategy="afterInteractive"
        />

        {/* Structured data */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
      </head>

      <body className={`${activeFont.className} antialiased`} suppressHydrationWarning>
        <AppProvider>
          <MaintenanceGuard>
            <Header />
            <Sidebar />
            <MobileNav />
            <InkDots />
            <AchievementToast />
            <PWAInstall />
            <LibraryPicker />

            {/* Hilltop script (purple-text.com) — domain-specific */}
            <AdScriptLoader />

            {/* A-ADS banner (domain-specific unit ID + colors) — top banner for non-reader pages */}
            <AAdsBanner hideOnReader />

            <main>{children}</main>

            <Toaster position="bottom-right" />
          </MaintenanceGuard>
        </AppProvider>

        <AnalyticsProvider />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
