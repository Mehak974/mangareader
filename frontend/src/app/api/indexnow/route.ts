import { NextRequest } from "next/server";
import { submitToIndexNow } from "@/lib/indexnow";

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "urls array required" }, { status: 400 });
    }

    await submitToIndexNow(urls);
    return Response.json({ success: true, submitted: urls.length });
  } catch (err) {
    console.error("IndexNow API error:", err);
    return Response.json({ error: "Failed to submit to IndexNow" }, { status: 500 });
  }
}
