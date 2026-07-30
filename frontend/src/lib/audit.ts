/**
 * Audit logging.
 *
 * Records privileged actions (publish, ban, delete, settings changes) to the
 * `audit_logs` table for the admin Security module. Best-effort: a logging
 * failure must never block the action it describes.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

export async function audit(entry: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta as object | undefined,
        ip: entry.ip,
        userAgent: entry.userAgent,
      },
    })
    .catch(() => {});
}
