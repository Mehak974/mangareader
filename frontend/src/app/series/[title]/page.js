"use client";

import MangaDetail from "@/app/manga/[title]/page";

export default function SeriesPage({ params }) {
  return <MangaDetail params={params} allowProtected={true} />;
}
