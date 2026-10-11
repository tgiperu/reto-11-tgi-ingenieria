import type { Database } from "@reto-11-tgi-ingenieria/db";
import { auditLog } from "@reto-11-tgi-ingenieria/db/schema/inventory";

export interface Actor {
  id: string;
  name: string;
}

export interface AuditEntry {
  action: string;
  detail?: Record<string, unknown> | null;
  entity?: string;
  entityId?: string;
  plotNumber?: number | null;
  reason?: string | null;
}

export async function writeAudit(
  db: Database,
  actor: Actor,
  entry: AuditEntry
): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    detail: entry.detail ?? null,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
    plotNumber: entry.plotNumber ?? null,
    reason: entry.reason ?? null,
    userId: actor.id,
    userName: actor.name,
  });
}
