/**
 * GET /api/auth/me — return the current authenticated user, or 401.
 * Used by the client AppContext to hydrate session state on load.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicUser } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: publicUser(user) });
}
