import { SITE_NAME } from "@/lib/seo";

/**
 * PWA web app manifest.
 *
 * Enables install-to-home-screen and standalone display. Colors match the
 * app's dark, purple-accented theme.
 */
export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "Sync reading across devices. Bookmark chapters, track progress, discover new series — without ads.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0612",
    theme_color: "#a855f7",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
