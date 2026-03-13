import sql from "../config/database.js";

/**
 * Centralized Audit Logger
 * Supports flexible metadata and is safe for production usage.
 */
export async function logAudit({
  user_id = null,
  action,
  entity_id = null,
  entity_type = null,
  details = null
}) {
  try {
    // Skip if no action provided
    if (!action) {
      console.warn("Audit log skipped: action is required");
      return;
    }

    await sql`
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        performed_by
      )
      VALUES (
        ${entity_type},
        ${entity_id},
        ${action},
        ${user_id}
      )
    `;
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}