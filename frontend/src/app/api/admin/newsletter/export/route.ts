import type { NextRequest } from "next/server";
import { withRole } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// Escape a value for inclusion in a CSV cell (RFC 4180 quoting).
function csvCell(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

// GET /api/admin/newsletter/export — download all subscribers as CSV.
export const GET = withRole("EDITOR", async (req: NextRequest, { user }) => {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, confirmed: true, confirmedAt: true, createdAt: true },
  });

  const header = ["email", "confirmed", "confirmed_at", "subscribed_at"];
  const rows = subscribers.map((s) =>
    [
      s.email,
      s.confirmed ? "true" : "false",
      s.confirmedAt ? s.confirmedAt.toISOString() : "",
      s.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\r\n");

  await audit({
    userId: user.id,
    action: "newsletter.export",
    entity: "NewsletterSubscriber",
    meta: { count: subscribers.length },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
