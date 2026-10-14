export const revalidate = 86400;

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  const fallbackTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");

  return {
    title: `${fallbackTitle} — Read Online | MangaReader`,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    },
  };
}

export default function MangaSeriesLayout({ children }) {
  return <>{children}</>;
}
