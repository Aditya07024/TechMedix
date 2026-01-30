import sql from "../config/database.js";
import { v4 as uuid } from "uuid";
import { getTimesFromFrequency } from "../services/scheduleService.js";

const adherenceAgent = {
  async execute({ prescriptionId }) {
    console.log("⏰ Agent-4 (Adherence) started");

    const meds = await sql`
      SELECT * FROM prescription_medicines
      WHERE prescription_id = ${prescriptionId}
    `;

    console.log(`📥 Loaded ${meds.length} medicine(s) for adherence planning`);

    if (!meds.length) {
      console.warn("⚠️ No medicines found for adherence scheduling");
      console.log("ℹ️ Agent-4 skipped reminder creation because prescription has no medicines");
      console.log("✅ Agent-4 completed with ZERO reminders");
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
      const times = getTimesFromFrequency(med.frequency);
      const duration = Number(med.duration) || 5;
      const doses = times.length * duration;

      console.log(`\n💊 Medicine: ${med.medicine_name}`);
      console.log(`   Frequency: ${med.frequency}`);
      console.log(`   Duration: ${duration} days`);
      console.log(`   Scheduled times: ${times.join(", ")}`);
      console.log(`   Total doses: ${doses}`);

      const reminderId = uuid();

      /* ---------- REMINDER (MASTER) ---------- */
      await sql`
        INSERT INTO reminders (
          id,
          prescription_id,
          medicine_name,
          dosage,
          scheduled_times,
          duration_days,
          instructions,
          is_active
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
          true
        )
      `;

      /* ---------- DAILY SCHEDULE ---------- */
      for (let day = 0; day < duration; day++) {
        for (const time of times) {
          await sql`
            INSERT INTO adherence_schedule (
              id,
              reminder_id,
              scheduled_datetime,
              status
            )
            VALUES (
              ${uuid()},
              ${reminderId},
              (
                CURRENT_DATE
                + ${day} * INTERVAL '1 day'
                + ${time}::time
              ),
              'pending'
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

    console.log("\n📊 Adherence Summary:");
    console.table(
      summary.medicines.map(m => ({
        Medicine: m.medicine,
        Frequency: m.frequency,
        Duration_Days: m.duration_days,
        Scheduled_Times: m.scheduled_times.join(", "),
        Total_Doses: m.total_doses
      }))
    );

    console.log(`🧾 Medicines processed: ${summary.totalMedicines}`);
    console.log(`⏰ Reminders created: ${summary.totalReminders}`);
    console.log(`💊 Total doses scheduled: ${summary.totalDoses}`);
    console.log("✅ Agent-4 completed successfully with detailed schedule");

    return {
      success: true,
      summary,
    };
  },
};

export default adherenceAgent;