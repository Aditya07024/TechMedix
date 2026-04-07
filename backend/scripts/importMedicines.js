import fs from "fs";
import csv from "csv-parser";
import sql from "../config/database.js";

const results = [];

function cleanText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
}

function collectRowSeries(row, prefix, maxIndex) {
  const values = [];

  for (let i = 0; i <= maxIndex; i += 1) {
    const value = cleanText(row[`${prefix}${i}`]);
    if (value) {
      values.push(value);
    }
  }

  return values;
}

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
        await sql`
          INSERT INTO medicines (
            name,
            salt,
            salts,
            substitutes,
            side_effects,
            uses,
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
            ${cleanText(row.name)},
            ${cleanText(row.salt)},
            ${String(row.salt ?? "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)},
            ${collectRowSeries(row, "substitute", 4)},
            ${collectRowSeries(row, "sideEffect", 41)},
            ${collectRowSeries(row, "use", 4)},
            ${cleanText(row["Chemical Class"])},
            ${row["Habit Forming"] === "Yes"},
            ${cleanText(row["Therapeutic Class"])},
            ${cleanText(row["Action Class"])},
            ${cleanText(row.working)},
            ${cleanText(row.safetyadvice)},
            ${row.price ? parseFloat(row.price) : null},
            ${cleanText(row.usage)},
            ${cleanText(row.image)},
            ${cleanText(row.link)},
            ${cleanText(row.info)},
            ${cleanText(row.benefits)},
            ${cleanText(row.sideeffects)},
            ${cleanText(row.category)}
          )
        `;

        console.log(`✅ Inserted: ${row.name}`);
      } catch (err) {
        console.error(`❌ Error with ${row.name}:`, err.message);
      }
    }

    console.log("🎉 Import complete");
    process.exit();
  });
