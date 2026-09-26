import { PrismaClient } from "@prisma/client";
import { PrismaNeon }   from "@prisma/adapter-neon";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloading can repeatedly evaluate this module and
 * create many `PrismaClient` instances, exhausting the database connection pool
 * (a real risk on Neon's free tier). Caching the instance on `globalThis`
 * prevents that. In production a single instance is created per server process.
 *
 * On Cloudflare Pages / Workers, standard Prisma's TCP connection cannot be used
 * (Workers have no raw TCP sockets). Neon's serverless HTTP/WebSocket driver
 * is used instead — same Prisma API, tunneled over HTTP.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Cloudflare Pages / Workers — use Neon's HTTP adapter (no raw TCP)
  if (process.env.CF_PAGES || process.env.NEXT_RUNTIME === "edge") {
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
    return new PrismaClient({ adapter,
      log: process.env.NODE_ENV === "development" ? ["warn","error"] : ["error"],
    });
  }

  // Local dev / Railway Node.js server — standard TCP connection
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn","error"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
