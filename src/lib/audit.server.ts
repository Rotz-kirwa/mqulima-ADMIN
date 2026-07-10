import { getDb } from "./db.server";

export interface AuditLogData {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  diff?: any;
}

export async function writeAuditLog({ actorId, action, entityType, entityId, diff }: AuditLogData) {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO audit_log (actor_id, action, entity_type, entity_id, diff)
      VALUES (${actorId}, ${action}, ${entityType}, ${entityId}, ${diff ? sql.json(diff) : null})
    `;
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
