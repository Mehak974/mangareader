import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "7d";

    let startDate = new Date();
    if (range === "24h") startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    else if (range === "7d") startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    else if (range === "30d") startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, uniqueVisitors, topPages, recent, byDay] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: startDate } } }),
      prisma.pageView.count({
        where: {
          createdAt: { gte: startDate },
          userId: { not: null },
        },
      }),
      prisma.pageView.groupBy({
        by: ["path"],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.pageView.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          path: true,
          userId: true,
          referrer: true,
          createdAt: true,
        },
      }),
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM page_views
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `,
    ]);

    return new Response(
      JSON.stringify({
        range,
        total,
        uniqueVisitors,
        topPages: topPages.map((p) => ({
          path: p.path,
          views: p._count.id,
        })),
        recent: recent.map((r) => ({
          id: r.id,
          path: r.path,
          userId: r.userId,
          referrer: r.referrer,
          createdAt: r.createdAt,
        })),
        byDay: byDay.map((d) => ({
          date: d.date ? new Date(d.date).toISOString().split("T")[0] : "",
          count: parseInt(d.count),
        })),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[admin analytics]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
