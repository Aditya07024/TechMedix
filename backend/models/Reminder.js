import sql from "../config/database.js";

/*
  CREATE REMINDER
*/
export const createReminder = async (data) => {
  try {
    const result = await sql`
      INSERT INTO reminders (
        user_id,
        medicine_name,
        dosage,
        scheduled_time,
        frequency,
        created_by,
        next_scheduled,
        is_active,
        created_at
      )
      VALUES (
        ${data.user_id},
        ${data.medicine_name},
        ${data.dosage},
        ${data.scheduled_time},
        ${data.frequency},
        ${data.created_by},
        ${data.next_scheduled || data.scheduled_time},
        TRUE,
        NOW()
      )
      RETURNING *
    `;

    return result[0];

  } catch (error) {
    console.error("Create reminder failed:", error);
    return null;
  }
};


/*
  GET USER REMINDERS (Active Only)
*/
export const getUserReminders = async (userId) => {
  try {
    return await sql`
      SELECT *
      FROM reminders
      WHERE user_id = ${userId}
        AND is_active = TRUE
      ORDER BY next_scheduled ASC
    `;
  } catch (error) {
    console.error("Fetch reminders failed:", error);
    return [];
  }
};