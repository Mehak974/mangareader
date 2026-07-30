/**
 * Helpers for protecting admin/editor API route handlers.
 *
 * `withRole` wraps a handler so it only runs for users holding the required
 * role; otherwise it returns a 401/403 JSON response. Authorization is a real
 * server-side session lookup (see {@link requireRole}), so it cannot be spoofed
 * from the client.
 */
import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { User, UserRole } from "@prisma/client";
import { requireRole, AuthError } from "@/lib/auth";

type Handler = (
  req: NextRequest,
  ctx: { user: User; params: Record<string, string> }
) => Promise<Response> | Response;

/** Wrap a route handler, enforcing `role` before it runs. */
export function withRole(role: UserRole, handler: Handler) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    let user: User;
    try {
      user = await requireRole(role);
    } catch (err) {
      if (err instanceof AuthError) {
        const status = err.kind === "unauthenticated" ? 401 : 403;
        return NextResponse.json({ error: err.kind }, { status });
      }
      throw err;
    }
    const params = routeCtx?.params ? await routeCtx.params : {};
    return handler(req, { user, params });
  };
}
