import sql from "../config/database.js";

export async function logAudit(entityType, entityId, action, user) {
  try {
    if (!entityType || !entityId || !action) {
      console.warn("Audit log skipped: missing required fields");
      return;
    }

    const performedBy = user?.id ?? null;
    const role = user?.role ?? 'system';

    await sql`
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        performed_by,
        role
      )
      SELECT
        ${entityType},
        ${entityId},
        ${action},
        ${performedBy},
        ${role}
      WHERE NOT EXISTS (
        SELECT 1 FROM audit_logs
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
          AND action = ${action}
          AND performed_by IS NOT DISTINCT FROM ${performedBy}
          AND created_at >= NOW() - INTERVAL '1 minute'
      )
    `;
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}