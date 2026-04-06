import fs from "fs";
import csv from "csv-parser";
import sql from "../config/database.js";

const results = [];

fs.createReadStream("data/medicines.csv")
  .pipe(csv())
  .on("data", (row) => {
    results.push(row);
  })
  .on("end", async () => {
    console.log("CSV Loaded:", results.length);

    for (const row of results) {
      try {
        // 1️⃣ Insert into medicines table
        const medRes = await sql`
          INSERT INTO medicines (
            name,
            salt,
            chemical_class,
            habit_forming,
            therapeutic_class,
            action_class,
            working,
            safetyadvice,
            price,
            usage,
            image,
            link,
            info,
            benefits,
            sideeffects,
            category
          )
          VALUES (
            ${row.name || null},
            ${row.salt || null},
            ${row["Chemical Class"] || null},
            ${row["Habit Forming"] === "Yes"},
            ${row["Therapeutic Class"] || null},
            ${row["Action Class"] || null},
            ${row.working || null},
            ${row.safetyadvice || null},
            ${row.price ? parseFloat(row.price) : null},
            ${row.usage || null},
            ${row.image || null},
            ${row.link || null},
            ${row.info || null},
            ${row.benefits || null},
            ${row.sideeffects || null},
            ${row.category || null}
          )
          RETURNING id
        `;

        const medicineId = medRes[0].id;

        // 🧬 Insert salts
        if (row.salt && row.salt.trim() !== "") {
          const salts = row.salt.split(",");
          for (const s of salts) {
            if (s.trim() !== "") {
              await sql`
                INSERT INTO medicine_salts (medicine_id, salt_name)
                VALUES (${medicineId}, ${s.trim()})
              `;
            }
          }
        }

        // 2️⃣ Insert substitutes
        for (let i = 0; i <= 4; i++) {
          const sub = row[`substitute${i}`];
          if (sub && sub.trim() !== "") {
            await sql`
              INSERT INTO medicine_substitutes (medicine_id, substitute_name)
              VALUES (${medicineId}, ${sub.trim()})
            `;
          }
        }

        // 3️⃣ Insert side effects
        for (let i = 0; i <= 41; i++) {
          const effect = row[`sideEffect${i}`];
          if (effect && effect.trim() !== "") {
            await sql`
              INSERT INTO medicine_side_effects (medicine_id, side_effect)
              VALUES (${medicineId}, ${effect.trim()})
            `;
          }
        }

        // 4️⃣ Insert uses
for (let i = 0; i <= 4; i++) {
  const use = row[`use${i}`];
  if (use && use.trim() !== "") {
    await sql`
      INSERT INTO medicine_uses (medicine_id, "use")
      VALUES (${medicineId}, ${use.trim()})
    `;
  }
}

        console.log(`✅ Inserted: ${row.name}`);
      } catch (err) {
        console.error(`❌ Error with ${row.name}:`, err.message);
      }
    }

    console.log("🎉 Import complete");
    process.exit();
  });