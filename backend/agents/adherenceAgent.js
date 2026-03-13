import sql from "../config/database.js";
import { v4 as uuid } from "uuid";
import { getTimesFromFrequency } from "../services/scheduleService.js";

const adherenceAgent = {
  async execute({ prescriptionId }) {
    console.log("⏰ Agent-4 (Adherence) started");

    // Wrap everything in transaction for safety
    return await sql.begin(async (tx) => {

      const meds = await tx`
        SELECT * FROM prescription_medicines
        WHERE prescription_id = ${prescriptionId}
      `;

      if (!meds.length) {
        return {
          success: true,
          summary: {
            prescriptionId,
            totalMedicines: 0,
            totalReminders: 0,
            totalDoses: 0,
            medicines: []
          }
        };
      }

      const summary = {
        prescriptionId,
        totalMedicines: meds.length,
        totalReminders: 0,
        totalDoses: 0,
        medicines: [],
      };

      for (const med of meds) {

        // 🚫 Prevent duplicate reminders
        const existing = await tx`
          SELECT id FROM reminders
          WHERE prescription_id = ${prescriptionId}
            AND medicine_name = ${med.medicine_name}
            AND is_active = true
          LIMIT 1
        `;

        if (existing.length) {
          console.log(`⚠️ Reminder already exists for ${med.medicine_name}, skipping`);
          continue;
        }

        const times = getTimesFromFrequency(med.frequency);
        const duration = Number(med.duration) || 5;
        const doses = times.length * duration;

        const reminderId = uuid();

        // ---------- MASTER REMINDER ----------
        await tx`
          INSERT INTO reminders (
            id,
            prescription_id,
            medicine_name,
            dosage,
            scheduled_times,
            duration_days,
            instructions,
            is_active,
            created_at
          )
          VALUES (
            ${reminderId},
            ${prescriptionId},
            ${med.medicine_name},
            ${med.dosage},
            (
              SELECT array_agg(t::time)
              FROM unnest(${times}::text[]) AS t
            ),
            ${duration},
            ${med.instructions ?? "After food"},
            true,
            NOW()
          )
        `;

        // ---------- DAILY DOSE SCHEDULE ----------
        for (let day = 0; day < duration; day++) {
          for (const time of times) {
            await tx`
              INSERT INTO adherence_schedule (
                id,
                reminder_id,
                scheduled_datetime,
                status,
                created_at
              )
              VALUES (
                ${uuid()},
                ${reminderId},
                (
                  CURRENT_DATE
                  + INTERVAL '1 day'   -- start from tomorrow
                  + ${day} * INTERVAL '1 day'
                  + ${time}::time
                ),
                'pending',
                NOW()
              )
            `;
          }
        }

        summary.totalReminders += 1;
        summary.totalDoses += doses;

        summary.medicines.push({
          medicine: med.medicine_name,
          frequency: med.frequency,
          duration_days: duration,
          scheduled_times: times,
          total_doses: doses,
        });
      }

      console.log("✅ Agent-4 completed successfully");

      return {
        success: true,
        summary,
      };
    });
  }
};

export default adherenceAgent;