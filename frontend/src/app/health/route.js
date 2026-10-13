export function GET() {
  return Response.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
