/**
 * layout.tsx — Domain-aware root layout
 *
 * Replaces src/app/layout.js
 *
 * Changes from the original:
 *  - All brand strings come from site-config.ts (name, description, OG image)
 *  - Google / Bing verification meta tags injected per domain
 *  - AdSense publisher script injected per domain (if ADSENSE_ENABLED)
 *  - Google Font chosen per domain (DM Sans / Inter / Plus Jakarta Sans)
 *  - AAdsBanner + AdScriptLoader already use site-config internally
 */

import dynamic from 'next/dynamic';
import type { Metadata } from 'next';
import './globals.css';
import { AppProvider }      from '@/context/AppContext';
import { Toaster }          from 'react-hot-toast';
import Header               from '@/components/Header';
import JsonLd               from '@/components/JsonLd';
import MaintenanceGuard     from '@/components/MaintenanceGuard';
import { Analytics }        from '@vercel/analytics/next';
import { SpeedInsights }    from '@vercel/speed-insights/next';
import {
  SITE_NAME, SITE_URL, SEO, AD_CONFIG, ADSENSE_ENABLED,
  siteConfig,
} from '@/lib/site-config';
import { organizationSchema, websiteSchema } from '@/lib/seo';

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
      ...(AD_CONFIG.hilltopVerification ? { [AD_CONFIG.hilltopVerification]: AD_CONFIG.hilltopVerification } : {}),
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

  alternates: { canonical: '/' },

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
        {/* CSS custom properties for per-domain theme colours */}
        <style>{`
          :root {
            --accent:        ${siteConfig.theme.accentColor};
            --accent-hover:  ${siteConfig.theme.accentHover};
            --bg-dark:       ${siteConfig.theme.bgDark};
            --bg-card:       ${siteConfig.theme.bgCard};
          }
        `}</style>

        {/* Google AdSense — only when NEXT_PUBLIC_ADSENSE_ID is set */}
        {ADSENSE_ENABLED && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.adsenseId}`}
            crossOrigin="anonymous"
          />
        )}

        {/* Structured data */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
      </head>

      <body className={`${activeFont.className} antialiased`}>
        <AppProvider>
          <MaintenanceGuard>
            <Header />
            <Sidebar />
            <MobileNav />
            <InkDots />
            <AchievementToast />
            <PWAInstall />
            <LibraryPicker />

            {/* Pop-ads script (domain-specific) */}
            <AdScriptLoader />

            {/* A-ADS banner (domain-specific unit ID + colors) */}
            <AAdsBanner />

            <main>{children}</main>

            <Toaster position="bottom-right" />
          </MaintenanceGuard>
        </AppProvider>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
