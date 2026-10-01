/**
 * GET /api/health
 *
 * Container liveness probe. Returns 200 with a minimal payload so Railway,
 * Docker, or a load balancer can verify the process is up without triggering
 * any DB or upstream calls.
 *
 * For readiness, see /api/health/ready (not yet implemented — add it when
 * the app needs to gate traffic behind database connectivity).
 */

export function GET() {
  return Response.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}