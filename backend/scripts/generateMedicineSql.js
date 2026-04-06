import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "../data/medicines.csv");
const outputPath = path.join(__dirname, "medicine.sql");

function cleanText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseInteger(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseNumeric(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHabitForming(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function writeMedicineInsert(stream, medicine) {
  stream.write(
    `INSERT INTO medicines (` +
      `id, name, salt, chemical_class, habit_forming, therapeutic_class, action_class, working, safetyadvice, price, usage, image, link, info, benefits, sideeffects, category, created_at, updated_at, is_deleted` +
      `) VALUES (` +
      `${sqlValue(medicine.id)}, ${sqlValue(medicine.name)}, ${sqlValue(medicine.salt)}, ${sqlValue(medicine.chemical_class)}, ${sqlValue(medicine.habit_forming)}, ${sqlValue(medicine.therapeutic_class)}, ${sqlValue(medicine.action_class)}, ${sqlValue(medicine.working)}, ${sqlValue(medicine.safetyadvice)}, ${sqlValue(medicine.price)}, ${sqlValue(medicine.usage)}, ${sqlValue(medicine.image)}, ${sqlValue(medicine.link)}, ${sqlValue(medicine.info)}, ${sqlValue(medicine.benefits)}, ${sqlValue(medicine.sideeffects)}, ${sqlValue(medicine.category)}, NOW(), NOW(), FALSE` +
      `);\n`,
  );
}

function writeRelationInsert(stream, tableName, medicineId, columnName, value) {
  stream.write(
    `INSERT INTO ${tableName} (medicine_id, ${columnName}) VALUES (${sqlValue(medicineId)}, ${sqlValue(value)});\n`,
  );
}

async function readMedicinesFromCsv() {
  return new Promise((resolve, reject) => {
    const medicines = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        const nextId = parseInteger(row.id, medicines.length + 1);
        medicines.push({
          id: nextId,
          name: cleanText(row.name),
          salt: cleanText(row.salt),
          chemical_class: cleanText(row["Chemical Class"]),
          habit_forming: parseHabitForming(row["Habit Forming"]),
          therapeutic_class: cleanText(row["Therapeutic Class"]),
          action_class: cleanText(row["Action Class"]),
          working: cleanText(row.working),
          safetyadvice: cleanText(row.safetyadvice),
          price: parseNumeric(row.price),
          usage: cleanText(row.usage),
          image: cleanText(row.image),
          link: cleanText(row.link),
          info: cleanText(row.info),
          benefits: cleanText(row.benefits),
          sideeffects: cleanText(row.sideeffects),
          category: cleanText(row.category),
          salts: (cleanText(row.salt) ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          substitutes: Array.from({ length: 5 }, (_, index) =>
            cleanText(row[`substitute${index}`]),
          ).filter(Boolean),
          side_effects: Array.from({ length: 42 }, (_, index) =>
            cleanText(row[`sideEffect${index}`]),
          ).filter(Boolean),
          uses: Array.from({ length: 5 }, (_, index) =>
            cleanText(row[`use${index}`]),
          ).filter(Boolean),
        });
      })
      .on("end", () => resolve(medicines))
      .on("error", reject);
  });
}

async function generateSqlFile() {
  const medicines = await readMedicinesFromCsv();
  const usedNames = new Set();
  const placeholderMedicines = [];
  let nextPlaceholderId =
    medicines.reduce((maxId, medicine) => Math.max(maxId, medicine.id), 0) + 1;

  for (const medicine of medicines) {
    if (medicine.name) {
      usedNames.add(normalizeName(medicine.name));
    }
  }

  for (const medicine of medicines) {
    for (const substituteName of medicine.substitutes) {
      const normalizedSubstituteName = normalizeName(substituteName);
      if (!normalizedSubstituteName || usedNames.has(normalizedSubstituteName)) {
        continue;
      }

      usedNames.add(normalizedSubstituteName);
      placeholderMedicines.push({
        id: nextPlaceholderId,
        name: substituteName,
        salt: null,
        chemical_class: null,
        habit_forming: null,
        therapeutic_class: null,
        action_class: null,
        working: null,
        safetyadvice: null,
        price: null,
        usage: null,
        image: null,
        link: null,
        info: "Auto-generated placeholder medicine created from substitute data in medicines.csv.",
        benefits: null,
        sideeffects: null,
        category: "substitute-placeholder",
      });
      nextPlaceholderId += 1;
    }
  }

  const stream = fs.createWriteStream(outputPath, { encoding: "utf8" });

  stream.write("-- Generated from backend/data/medicines.csv\n");
  stream.write("-- Includes placeholder medicine rows for substitutes missing from the main CSV list\n\n");
  stream.write("BEGIN;\n\n");
  stream.write("TRUNCATE TABLE medicine_uses, medicine_side_effects, medicine_substitutes, medicine_salts, medicines RESTART IDENTITY CASCADE;\n\n");

  for (const medicine of medicines) {
    writeMedicineInsert(stream, medicine);
  }

  stream.write("\n-- Placeholder substitute medicines\n");
  for (const medicine of placeholderMedicines) {
    writeMedicineInsert(stream, medicine);
  }

  stream.write("\n-- Salt mappings\n");
  for (const medicine of medicines) {
    for (const saltName of medicine.salts) {
      writeRelationInsert(stream, "medicine_salts", medicine.id, "salt_name", saltName);
    }
  }

  stream.write("\n-- Substitute mappings\n");
  for (const medicine of medicines) {
    for (const substituteName of medicine.substitutes) {
      writeRelationInsert(
        stream,
        "medicine_substitutes",
        medicine.id,
        "substitute_name",
        substituteName,
      );
    }
  }

  stream.write("\n-- Side effect mappings\n");
  for (const medicine of medicines) {
    for (const sideEffect of medicine.side_effects) {
      writeRelationInsert(
        stream,
        "medicine_side_effects",
        medicine.id,
        "side_effect",
        sideEffect,
      );
    }
  }

  stream.write("\n-- Use mappings\n");
  for (const medicine of medicines) {
    for (const useName of medicine.uses) {
      writeRelationInsert(stream, "medicine_uses", medicine.id, '"use"', useName);
    }
  }

  let finalSequenceId = 1;
  for (const medicine of medicines) {
    if (medicine.id > finalSequenceId) {
      finalSequenceId = medicine.id;
    }
  }
  for (const medicine of placeholderMedicines) {
    if (medicine.id > finalSequenceId) {
      finalSequenceId = medicine.id;
    }
  }

  stream.write(
    `\nSELECT setval(pg_get_serial_sequence('medicines', 'id'), ${finalSequenceId}, TRUE);\n`,
  );
  stream.write("\nCOMMIT;\n");

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end();
  });

  console.log(
    JSON.stringify(
      {
        outputPath,
        sourceMedicines: medicines.length,
        placeholderMedicines: placeholderMedicines.length,
        totalMedicines: medicines.length + placeholderMedicines.length,
      },
      null,
      2,
    ),
  );
}

generateSqlFile().catch((error) => {
  console.error("Failed to generate medicine.sql:", error);
  process.exit(1);
});
