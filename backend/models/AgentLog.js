import sql from "../config/database.js";

export const logAgentStart = async (data) => {
  const res = await sql`
    INSERT INTO agent_logs (
      workflow_id, agent_name, status, input_data, started_at
    )
    VALUES (
      ${data.workflow_id},
      ${data.agent_name},
      'running',
      ${data.input_data},
      NOW()
    )
    RETURNING *
  `;
  return res[0];
};

export const logAgentEnd = async (id, data) => {
  await sql`
    UPDATE agent_logs
    SET status = ${data.status},
        output_data = ${data.output_data},
        error_message = ${data.error_message},
        completed_at = NOW(),
        duration_ms = ${data.duration_ms}
    WHERE id = ${id}
  `;
};