import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../data/medicines.csv");

let csvCachePromise;

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function tokenizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function collectRowSeries(row, prefix, maxIndex) {
  const values = [];

  for (let index = 0; index <= maxIndex; index += 1) {
    const value = cleanText(row[`${prefix}${index}`]);
    if (value) {
      values.push(value);
    }
  }

  return values;
}

function parsePrice(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHabitForming(value) {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function scoreFieldMatch(fieldValue, query) {
  const rawField = String(fieldValue ?? "").toLowerCase().trim();
  const normalizedField = normalizeText(fieldValue);
  const normalizedQuery = normalizeText(query);

  if (!rawField || !normalizedQuery) {
    return 0;
  }

  if (normalizedField === normalizedQuery) {
    return 120;
  }

  if (normalizedField.startsWith(normalizedQuery)) {
    return 90;
  }

  const fieldTokens = tokenizeText(fieldValue);
  const queryTokens = tokenizeText(query);

  const fullTokenMatch = queryTokens.every((queryToken) =>
    fieldTokens.some((fieldToken) => fieldToken === queryToken),
  );
  if (fullTokenMatch && queryTokens.length > 0) {
    return 75;
  }

  const tokenPrefixMatch = queryTokens.every((queryToken) =>
    fieldTokens.some((fieldToken) => fieldToken.startsWith(queryToken)),
  );
  if (tokenPrefixMatch && queryTokens.length > 0) {
    return 60;
  }

  if (normalizedField.includes(normalizedQuery)) {
    return 45;
  }

  const partialTokenMatch = queryTokens.filter((queryToken) =>
    fieldTokens.some((fieldToken) => fieldToken.includes(queryToken)),
  ).length;

  if (partialTokenMatch > 0) {
    return 20 + partialTokenMatch;
  }

  return 0;
}

function scoreMedicineMatch(medicine, { search, saltSearch }) {
  const nameScore = search ? scoreFieldMatch(medicine.name, search) : 0;
  const saltScoreFromNameSearch = search ? scoreFieldMatch(medicine.salt, search) : 0;
  const saltScore = saltSearch ? scoreFieldMatch(medicine.salt, saltSearch) : 0;

  return {
    total:
      nameScore * 3 +
      saltScoreFromNameSearch +
      saltScore * 3,
    nameScore,
    saltScoreFromNameSearch,
    saltScore,
  };
}

function compareMedicinesByRelevance(left, right) {
  if (right.score.total !== left.score.total) {
    return right.score.total - left.score.total;
  }

  if (right.score.nameScore !== left.score.nameScore) {
    return right.score.nameScore - left.score.nameScore;
  }

  if (right.score.saltScore !== left.score.saltScore) {
    return right.score.saltScore - left.score.saltScore;
  }

  const nameCompare = String(left.medicine.name ?? "").localeCompare(
    String(right.medicine.name ?? ""),
  );
  if (nameCompare !== 0) {
    return nameCompare;
  }

  return left.medicine.id - right.medicine.id;
}

function mapRowToMedicine(row, index) {
  const id = Number.parseInt(row.id, 10);
  const salt = cleanText(row.salt);

  return {
    id: Number.isInteger(id) ? id : index + 1,
    name: cleanText(row.name),
    salt,
    chemical_class: cleanText(row["Chemical Class"]),
    habit_forming: parseHabitForming(row["Habit Forming"]),
    therapeutic_class: cleanText(row["Therapeutic Class"]),
    action_class: cleanText(row["Action Class"]),
    working: cleanText(row.working),
    safetyadvice: cleanText(row.safetyadvice),
    price: parsePrice(row.price),
    usage: cleanText(row.usage),
    image: cleanText(row.image),
    link: cleanText(row.link),
    info: cleanText(row.info),
    benefits: cleanText(row.benefits),
    sideeffects: cleanText(row.sideeffects),
    category: cleanText(row.category),
    created_at: null,
    updated_at: null,
    is_deleted: false,
    salts: salt
      ? salt
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    substitutes: collectRowSeries(row, "substitute", 4),
    side_effects: collectRowSeries(row, "sideEffect", 41),
    uses: collectRowSeries(row, "use", 4),
  };
}

async function loadCsvCache() {
  const medicines = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on("data", (row) => {
        medicines.push(mapRowToMedicine(row, medicines.length));
      })
      .on("end", resolve)
      .on("error", reject);
  });

  medicines.sort((left, right) => {
    const nameCompare = (left.name ?? "").localeCompare(right.name ?? "");
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.id - right.id;
  });

  const byId = new Map();
  const byNormalizedName = new Map();

  for (const medicine of medicines) {
    byId.set(medicine.id, medicine);

    const normalizedName = normalizeText(medicine.name);
    if (!normalizedName) {
      continue;
    }

    if (!byNormalizedName.has(normalizedName)) {
      byNormalizedName.set(normalizedName, []);
    }

    byNormalizedName.get(normalizedName).push(medicine);
  }

  return {
    medicines,
    byId,
    byNormalizedName,
  };
}

async function getCsvCache() {
  if (!csvCachePromise) {
    csvCachePromise = loadCsvCache().catch((error) => {
      csvCachePromise = null;
      throw error;
    });
  }

  return csvCachePromise;
}

function resolveSubstituteDetails(cache, substituteNames, excludeMedicineId = null) {
  const resolved = [];
  const seenIds = new Set();

  for (const substituteName of substituteNames) {
    const normalizedSubstitute = normalizeText(substituteName);
    if (!normalizedSubstitute) {
      continue;
    }

    const exactMatches = cache.byNormalizedName.get(normalizedSubstitute) ?? [];

    const candidateMatches =
      exactMatches.length > 0
        ? exactMatches
        : cache.medicines.filter((medicine) => {
            const normalizedMedicineName = normalizeText(medicine.name);
            return (
              normalizedMedicineName.startsWith(normalizedSubstitute) ||
              normalizedSubstitute.startsWith(normalizedMedicineName)
            );
          });

    for (const medicine of candidateMatches) {
      if (medicine.id === excludeMedicineId || seenIds.has(medicine.id)) {
        continue;
      }

      seenIds.add(medicine.id);
      resolved.push(toMedicineSummary(medicine));
    }
  }

  return resolved;
}

export function toMedicineSummary(medicine) {
  return {
    id: medicine.id,
    name: medicine.name,
    salt: medicine.salt,
    therapeutic_class: medicine.therapeutic_class,
    price: medicine.price,
    image: medicine.image,
    category: medicine.category,
    habit_forming: medicine.habit_forming,
  };
}

export async function getMedicinesFromCsv({
  page,
  limit,
  search,
  saltSearch,
  chemicalClass,
  therapeuticClass,
  actionClass,
  category,
  habitForming,
}) {
  const cache = await getCsvCache();

  const ranked = cache.medicines.map((medicine) => ({
    medicine,
    score: scoreMedicineMatch(medicine, { search, saltSearch }),
  }));

  const filtered = ranked.filter(({ medicine, score }) => {
    if (search && score.nameScore === 0 && score.saltScoreFromNameSearch === 0) {
      return false;
    }

    if (saltSearch && score.saltScore === 0) {
      return false;
    }

    if (
      chemicalClass &&
      String(medicine.chemical_class ?? "").toLowerCase() !==
        chemicalClass.toLowerCase()
    ) {
      return false;
    }

    if (
      therapeuticClass &&
      String(medicine.therapeutic_class ?? "").toLowerCase() !==
        therapeuticClass.toLowerCase()
    ) {
      return false;
    }

    if (
      actionClass &&
      String(medicine.action_class ?? "").toLowerCase() !== actionClass.toLowerCase()
    ) {
      return false;
    }

    if (
      category &&
      String(medicine.category ?? "").toLowerCase() !== category.toLowerCase()
    ) {
      return false;
    }

    if (typeof habitForming === "boolean" && medicine.habit_forming !== habitForming) {
      return false;
    }

    return true;
  });

  const ordered = [...filtered].sort(compareMedicinesByRelevance);

  const total = ordered.length;
  const offset = (page - 1) * limit;
  const data = ordered.slice(offset, offset + limit).map(({ medicine }) =>
    toMedicineSummary(medicine),
  );

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getMedicineByIdFromCsv(id) {
  const cache = await getCsvCache();
  const medicine = cache.byId.get(id) ?? null;

  if (!medicine) {
    return null;
  }

  return {
    ...medicine,
    substitute_details: resolveSubstituteDetails(
      cache,
      medicine.substitutes,
      medicine.id,
    ),
  };
}

export async function searchMedicinesInCsv(query) {
  const cache = await getCsvCache();
  const normalizedQuery = String(query ?? "").trim();

  if (!normalizedQuery) {
    return [];
  }

  return cache.medicines
    .map((medicine) => ({
      medicine,
      score: scoreMedicineMatch(medicine, {
        search: normalizedQuery,
        saltSearch: "",
      }),
    }))
    .filter(({ score }) => score.nameScore > 0 || score.saltScoreFromNameSearch > 0)
    .sort(compareMedicinesByRelevance)
    .slice(0, 10)
    .map(({ medicine }) => ({
      id: medicine.id,
      name: medicine.name,
      salt: medicine.salt,
      price: medicine.price,
      image: medicine.image,
    }));
}

export async function getMedicineFiltersFromCsv() {
  const cache = await getCsvCache();

  const distinctValues = (field) =>
    [...new Set(cache.medicines.map((medicine) => medicine[field]).filter(Boolean))].sort(
      (left, right) => String(left).localeCompare(String(right)),
    );

  return {
    chemical_class: distinctValues("chemical_class"),
    therapeutic_class: distinctValues("therapeutic_class"),
    action_class: distinctValues("action_class"),
    category: distinctValues("category"),
  };
}

export async function getMedicineSubstitutesFromCsv(id) {
  const cache = await getCsvCache();
  const medicine = cache.byId.get(id) ?? null;

  if (!medicine) {
    return null;
  }

  return resolveSubstituteDetails(cache, medicine.substitutes, medicine.id);
}

export async function getMedicineSideEffectsFromCsv(id) {
  const cache = await getCsvCache();
  const medicine = cache.byId.get(id) ?? null;

  if (!medicine) {
    return null;
  }

  return medicine.side_effects;
}

export async function getMedicineUsesFromCsv(id) {
  const cache = await getCsvCache();
  const medicine = cache.byId.get(id) ?? null;

  if (!medicine) {
    return null;
  }

  return medicine.uses;
}
