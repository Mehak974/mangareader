import { NextResponse } from "next/server";
import { getMangaList } from "@/utils/anilist";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "36", 10);
    const genre = searchParams.get("genre") || "All";
    const sort = searchParams.get("sort");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || undefined;
    const countryOfOrigin = searchParams.get("countryOfOrigin") || undefined;
    const year = searchParams.get("year");
    const rating = searchParams.get("rating");

    let activeSort = ["TRENDING_DESC", "POPULARITY_DESC"];
    if (sort === "Top Rated") activeSort = ["SCORE_DESC", "POPULARITY_DESC"];
    else if (sort === "New Releases" || sort === "latest") activeSort = ["ID_DESC"];
    else if (sort === "A–Z") activeSort = ["TITLE_ROMAJI"];
    else if (sort === "Completed" || sort === "completed") activeSort = ["SCORE_DESC", "POPULARITY_DESC"];

    const variables = {
      page,
      perPage,
      status: status || undefined,
    };
    if (genre && genre !== "All") variables.genre = genre;
    if (search && search.trim()) {
      variables.search = search.trim();
    } else {
      variables.sort = activeSort;
    }
    if (countryOfOrigin && countryOfOrigin !== "All") variables.countryOfOrigin = countryOfOrigin;
    if (year && year !== "All") {
      variables.startDate_greater = parseInt(`${year}0000`);
      variables.startDate_lesser = parseInt(`${year}1232`);
    }
    if (rating && rating !== "All") {
      variables.averageScore_greater = parseInt(parseFloat(rating) * 20);
    }

    const data = await getMangaList(variables);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message, media: [] }, { status: 500 });
  }
}
