import sql from "../config/database.js";

export const createReminder = async (data) => {
  const res = await sql`
    INSERT INTO reminders (
      user_id, medicine_name, dosage,
      scheduled_time, frequency, created_by, next_scheduled
    )
    VALUES (
      ${data.user_id},
      ${data.medicine_name},
      ${data.dosage},
      ${data.scheduled_time},
      ${data.frequency},
      ${data.created_by},
      ${data.next_scheduled}
    )
    RETURNING *
  `;
  return res[0];
};

export const getUserReminders = async (userId) => {
  return await sql`
    SELECT * FROM reminders
    WHERE user_id = ${userId} AND is_active = true
  `;
};