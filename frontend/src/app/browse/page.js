import { getMangaList } from "@/utils/anilist";
import BrowseContent from "@/app/browse/BrowseContent";
import { proxyImage } from "@/utils/api";
import { buildMetadata, SITE_URL } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Browse Manga — Read Free Online",
  description: "Browse thousands of manga, manhwa, and manhua. Filter by genre, sort by popularity or latest updates. Free online manga reader.",
  path: "/browse",
});

function buildFetchVariables(params) {
  const sortParam = params?.sort;
  let activeSort = ["TRENDING_DESC", "POPULARITY_DESC"];
  if (sortParam === "latest") activeSort = ["ID_DESC"];
  else if (sortParam === "completed") activeSort = ["SCORE_DESC", "POPULARITY_DESC"];

  const q = params?.q || "";
  const genreParam = params?.genre || "All";

  const fetchVariables = {
    page: 1,
    perPage: 36,
    sort: activeSort,
    status: undefined,
  };
  if (genreParam !== "All") fetchVariables.genre = genreParam;
  if (q) fetchVariables.search = q;
  return fetchVariables;
}

async function fetchInitialData(params) {
  const fetchVariables = buildFetchVariables(params);
  try {
    return await getMangaList(fetchVariables);
  } catch {
    return null;
  }
}

export default async function Browse({ searchParams }) {
  const params = await searchParams;
  const initialData = await fetchInitialData(params);

  const priorityImages = (initialData?.media || [])
    .slice(0, 4)
    .map((m) => m.cover)
    .filter(Boolean);

  return (
    <div>
      {priorityImages.map((url) => (
        <link key={url} rel="preload" as="image" href={proxyImage(url, 400)} />
      ))}
      <BrowseContent initialData={initialData} initialParams={params} />
    </div>
  );
}
