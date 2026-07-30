/**
 * Request-context helpers for Route Handlers: extract client IP and user-agent
 * from proxy headers (Vercel/Cloudflare set these) with sensible fallbacks.
 */
import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export function userAgent(req: NextRequest): string {
  return req.headers.get("user-agent")?.slice(0, 300) ?? "";
}

/** Uniform JSON error response. */
export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
