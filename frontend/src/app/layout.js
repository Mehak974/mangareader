import { DM_Sans } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "react-hot-toast";
import Header from "@/components/Header";
import JsonLd from "@/components/JsonLd";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_NAME, SITE_URL, organizationSchema, websiteSchema } from "@/lib/seo";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const Sidebar = dynamic(() => import("@/components/Sidebar"));
const MobileNav = dynamic(() => import("@/components/MobileNav"));
const InkDots = dynamic(() => import("@/components/InkDots"));
const AchievementToast = dynamic(() => import("@/components/AchievementToast"));
const PWAInstall = dynamic(() => import("@/components/PWAInstall"));
const LibraryPicker = dynamic(() => import("@/components/LibraryPicker"));

const DEFAULT_DESCRIPTION =
  "Read manga, manhwa, and manhua free. Sync reading across devices, bookmark chapters, track progress, and discover new series.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Read Manga Free Online`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Read Manga Free Online`,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/og-default.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Read Manga Free Online`,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-default.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  }
};

export const viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="shortcut icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://s4.anilist.co" />
        {process.env.NEXT_PUBLIC_API_URL && (
          <link rel="preconnect" href={new URL(process.env.NEXT_PUBLIC_API_URL).origin} />
        )}
        <meta name="6a97888e-site-verification" content="96070b758f3aa1bd8cc49f6ef180d595" />
        <script dangerouslySetInnerHTML={{ __html: `(function(s){s.dataset.zone='11533092',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))` }} />
      </head>
      <body className={`${dmSans.className} dark bg-bg`} suppressHydrationWarning>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        <Toaster position="bottom-right" />
        <AppProvider>
          <MaintenanceGuard>
            <div id="app">
              <InkDots />
              <Header />
              <Sidebar />
              <main>{children}</main>
              <MobileNav />
              <AchievementToast />
              <PWAInstall />
              <LibraryPicker />
            </div>
          </MaintenanceGuard>
        </AppProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
