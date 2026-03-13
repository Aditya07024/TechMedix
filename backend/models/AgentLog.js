import sql from "../config/database.js";

export const logAgentStart = async (data) => {
  try {
    const result = await sql`
      INSERT INTO agent_logs (
        workflow_id,
        agent_name,
        status,
        input_data,
        started_at
      )
      VALUES (
        ${data.workflow_id},
        ${data.agent_name},
        'running',
        ${data.input_data || null},
        NOW()
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Agent start logging failed:", error);
    return null; // Do not break workflow
  }
};

export const logAgentEnd = async (id, data) => {
  try {
    const result = await sql`
      UPDATE agent_logs
      SET status = ${data.status || 'failed'},
          output_data = ${data.output_data || null},
          error_message = ${data.error_message || null},
          completed_at = NOW(),
          duration_ms = ${data.duration_ms || null}
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result.length) {
      console.warn("Agent log end: No matching log found for id:", id);
    }

  } catch (error) {
    console.error("Agent end logging failed:", error);
  }
};