import sql from "../config/database.js";

const MEDICINE_TABLE_CANDIDATES = ["medicines", "medixines"];

let medicineTableNamePromise;
let medicinesHasIsDeletedColumnPromise;
let medicineColumnsPromise;

async function getMedicineTableName() {
  if (!medicineTableNamePromise) {
    medicineTableNamePromise = sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${MEDICINE_TABLE_CANDIDATES})
      ORDER BY CASE table_name
        WHEN 'medicines' THEN 0
        WHEN 'medixines' THEN 1
        ELSE 2
      END
      LIMIT 1
    `
      .then((rows) => {
        const tableName = rows[0]?.table_name;

        if (!tableName) {
          throw new Error(
            `Medicine source table not found. Expected one of: ${MEDICINE_TABLE_CANDIDATES.join(", ")}`,
          );
        }

        return tableName;
      })
      .catch((error) => {
        medicineTableNamePromise = null;
        throw error;
      });
  }

  return medicineTableNamePromise;
}

async function medicinesHasIsDeletedColumn() {
  if (!medicinesHasIsDeletedColumnPromise) {
    const tableName = await getMedicineTableName();
    medicinesHasIsDeletedColumnPromise = sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = 'is_deleted'
      ) AS exists
    `
      .then((rows) => rows[0]?.exists === true)
      .catch((error) => {
        medicinesHasIsDeletedColumnPromise = null;
        throw error;
      });
  }

  return medicinesHasIsDeletedColumnPromise;
}

async function getMedicineColumns() {
  if (!medicineColumnsPromise) {
    const tableName = await getMedicineTableName();
    medicineColumnsPromise = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    `
      .then((rows) => new Set(rows.map((row) => row.column_name)))
      .catch((error) => {
        medicineColumnsPromise = null;
        throw error;
      });
  }

  return medicineColumnsPromise;
}

async function medicineHasColumn(columnName) {
  const columns = await getMedicineColumns();
  return columns.has(columnName);
}

async function buildMedicineSelect(columns) {
  const availableColumns = await getMedicineColumns();

  return columns
    .map((columnName) =>
      availableColumns.has(columnName)
        ? columnName
        : `NULL AS ${columnName}`,
    )
    .join(",\n        ");
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeStringArray(parsed);
      }
    } catch {
      // Fall back to delimited string parsing.
    }

    return [...new Set(trimmed.split(",").map((item) => item.trim()).filter(Boolean))];
  }

  return [];
}

function normalizeTextBlock(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();
  return stringValue || null;
}

function firstPresentValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];

    if (Array.isArray(value) && value.length > 0) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }

    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function collectSeriesValues(row, keys) {
  return keys
    .map((key) => row?.[key])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function buildIndexedKeys(prefix, count) {
  return Array.from({ length: count + 1 }, (_, index) => `${prefix}${index}`);
}

function normalizeHabitFormingValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

async function buildSubstituteLookupQuery(names) {
  const tableName = await getMedicineTableName();
  const clauses = [];
  const params = [];
  const normalizedNameSql =
    "regexp_replace(lower(trim(name)), '[^a-z0-9]+', '', 'g')";

  names.forEach((name) => {
    const normalized = normalizeText(name);
    if (!normalized) {
      return;
    }

    params.push(normalized);
    const exactPlaceholder = `$${params.length}`;

    params.push(`${normalized}%`);
    const startsWithPlaceholder = `$${params.length}`;

    params.push(normalized);
    const reverseStartsWithPlaceholder = `$${params.length}`;

    clauses.push(
      `(
        ${normalizedNameSql} = ${exactPlaceholder}
        OR ${normalizedNameSql} LIKE ${startsWithPlaceholder}
        OR ${reverseStartsWithPlaceholder} LIKE ${normalizedNameSql} || '%'
      )`,
    );
  });

  if (clauses.length === 0) {
    return null;
  }

  const whereClauses = [`(${clauses.join(" OR ")})`];
  if (await medicinesHasIsDeletedColumn()) {
    whereClauses.unshift("is_deleted = false");
  }

  const selectList = await buildMedicineSelect([
    "id",
    "name",
    "salt",
    "salts",
    "substitutes",
    "side_effects",
    "uses",
    "chemical_class",
    "habit_forming",
    "therapeutic_class",
    "action_class",
    "working",
    "safetyadvice",
    "price",
    "usage",
    "image",
    "link",
    "info",
    "benefits",
    "sideeffects",
    "category",
    "created_at",
    "updated_at",
  ]);

  return {
    query: `
      SELECT DISTINCT ON (id)
        ${selectList}
      FROM ${tableName}
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY id, name ASC
    `,
    params,
  };
}

function parseBooleanFilter(value) {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

export async function getMedicinesFromDb({
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
  const tableName = await getMedicineTableName();
  const clauses = [];
  const params = [];
  const [
    hasIsDeletedColumn,
    hasSaltColumn,
    hasShortComposition1Column,
    hasShortComposition2Column,
    hasSaltCompositionColumn,
    hasChemicalClassColumn,
    hasTherapeuticClassColumn,
    hasActionClassColumn,
    hasCategoryColumn,
    hasHabitFormingColumn,
    selectList,
  ] = await Promise.all([
    medicinesHasIsDeletedColumn(),
    medicineHasColumn("salt"),
    medicineHasColumn("short_composition1"),
    medicineHasColumn("short_composition2"),
    medicineHasColumn("salt_composition"),
    medicineHasColumn("chemical_class"),
    medicineHasColumn("therapeutic_class"),
    medicineHasColumn("action_class"),
    medicineHasColumn("category"),
    medicineHasColumn("habit_forming"),
    buildMedicineSelect([
      "id",
      "name",
      "salt",
      "short_composition1",
      "short_composition2",
      "manufacturer_name",
      "type",
      "pack_size_label",
      "therapeutic_class",
      "price",
      "image",
      "category",
      "habit_forming",
    ]),
  ]);

  if (hasIsDeletedColumn) {
    clauses.push("is_deleted = false");
  }

  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (search) {
    const placeholder = pushParam(`%${search}%`);
    clauses.push(`name ILIKE ${placeholder}`);
  }

  if (saltSearch && (hasSaltColumn || hasShortComposition1Column || hasShortComposition2Column || hasSaltCompositionColumn)) {
    const placeholder = pushParam(`%${saltSearch}%`);
    const saltClauses = [];

    if (hasSaltColumn) {
      saltClauses.push(`salt ILIKE ${placeholder}`);
    }

    if (hasShortComposition1Column) {
      saltClauses.push(`short_composition1 ILIKE ${placeholder}`);
    }

    if (hasShortComposition2Column) {
      saltClauses.push(`short_composition2 ILIKE ${placeholder}`);
    }

    if (hasSaltCompositionColumn) {
      saltClauses.push(`salt_composition ILIKE ${placeholder}`);
    }

    clauses.push(`(${saltClauses.join(" OR ")})`);
  } else if (saltSearch) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  if (chemicalClass && hasChemicalClassColumn) {
    const placeholder = pushParam(chemicalClass);
    clauses.push(`chemical_class = ${placeholder}`);
  } else if (chemicalClass) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  if (therapeuticClass && hasTherapeuticClassColumn) {
    const placeholder = pushParam(therapeuticClass);
    clauses.push(`therapeutic_class = ${placeholder}`);
  } else if (therapeuticClass) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  if (actionClass && hasActionClassColumn) {
    const placeholder = pushParam(actionClass);
    clauses.push(`action_class = ${placeholder}`);
  } else if (actionClass) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  if (category && hasCategoryColumn) {
    const placeholder = pushParam(category);
    clauses.push(`category = ${placeholder}`);
  } else if (category) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const parsedHabitForming = parseBooleanFilter(habitForming);
  if (parsedHabitForming !== null && hasHabitFormingColumn) {
    const placeholder = pushParam(parsedHabitForming);
    clauses.push(`habit_forming = ${placeholder}`);
  } else if (parsedHabitForming !== null) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const whereClause = clauses.length > 0 ? clauses.join(" AND ") : "TRUE";

  const countRows = await sql.query(
    `SELECT COUNT(*)::int AS total FROM ${tableName} WHERE ${whereClause}`,
    params,
  );
  const total = countRows[0]?.total ?? 0;

  const offset = (page - 1) * limit;
  const dataParams = [...params, limit, offset];
  const rows = await sql.query(
    `
      SELECT
        ${selectList}
      FROM ${tableName}
      WHERE ${whereClause}
      ORDER BY name ASC, id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    dataParams,
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getMedicineByIdFromDb(id) {
  const tableName = await getMedicineTableName();
  const whereClauses = ["id = $1"];
  if (await medicinesHasIsDeletedColumn()) {
    whereClauses.push("is_deleted = false");
  }

  const rows = await sql.query(
    `
      SELECT
        *
      FROM ${tableName}
      WHERE ${whereClauses.join(" AND ")}
      LIMIT 1
    `,
    [id],
  );

  const medicine = rows[0] ?? null;
  console.log("[medicine:getById] raw row from DB", {
    id,
    rowFound: Boolean(medicine),
    row: medicine,
  });

  if (!medicine) {
    return null;
  }

  const salts = normalizeStringArray(
    firstPresentValue(medicine, ["salts", "salt"]),
  );
  const rawSideEffectsText = normalizeTextBlock(medicine.side_effects);
  const substituteNames = normalizeStringArray(
    firstPresentValue(medicine, ["substitutes"]),
  );
  const legacySubstitutes = collectSeriesValues(
    medicine,
    buildIndexedKeys("substitute", 4),
  );
  const sideEffects = normalizeStringArray(
    firstPresentValue(medicine, ["side_effects", "sideeffects"]),
  );
  const legacySideEffects = collectSeriesValues(medicine, [
    ...buildIndexedKeys("sideEffect", 41),
    ...buildIndexedKeys("sideeffect", 41),
  ]);
  const uses = normalizeStringArray(firstPresentValue(medicine, ["uses", "usage"]));
  const legacyUses = collectSeriesValues(medicine, buildIndexedKeys("use", 4));

  const normalizedSubstitutes =
    substituteNames.length > 0 ? substituteNames : legacySubstitutes;
  const normalizedSideEffects =
    sideEffects.length > 0 ? sideEffects : legacySideEffects;
  const normalizedUses = uses.length > 0 ? uses : legacyUses;

  let substituteDetails = [];
  const substituteQuery = await buildSubstituteLookupQuery(normalizedSubstitutes);
  if (substituteQuery) {
    substituteDetails = await sql.query(
      substituteQuery.query,
      substituteQuery.params,
    );
  }

  const normalizedMedicine = {
    ...medicine,
    salt: firstPresentValue(medicine, ["salt"]) ?? (salts[0] ?? null),
    salts,
    substitutes: normalizedSubstitutes,
    substitute_details: substituteDetails,
    side_effects: normalizedSideEffects,
    side_effects_text:
      rawSideEffectsText ??
      normalizeTextBlock(medicine.sideeffects) ??
      normalizeTextBlock(normalizedSideEffects),
    uses: normalizedUses,
    chemical_class: firstPresentValue(medicine, [
      "chemical_class",
      "Chemical Class",
    ]),
    therapeutic_class: firstPresentValue(medicine, [
      "therapeutic_class",
      "Therapeutic Class",
    ]),
    action_class: firstPresentValue(medicine, [
      "action_class",
      "Action Class",
    ]),
    habit_forming: normalizeHabitFormingValue(
      firstPresentValue(medicine, ["habit_forming", "Habit Forming"]),
    ),
  };

  console.log("[medicine:getById] normalized payload", {
    id,
    payload: normalizedMedicine,
  });

  return normalizedMedicine;
}

export async function searchMedicinesInDb(query) {
  const tableName = await getMedicineTableName();
  const pattern = `%${query}%`;
  const [
    hasSaltColumn,
    hasShortComposition1Column,
    hasShortComposition2Column,
    hasSaltCompositionColumn,
  ] = await Promise.all([
    medicineHasColumn("salt"),
    medicineHasColumn("short_composition1"),
    medicineHasColumn("short_composition2"),
    medicineHasColumn("salt_composition"),
  ]);
  const searchClauses = ["name ILIKE $1"];

  if (hasSaltColumn) {
    searchClauses.push("salt ILIKE $1");
  }

  if (hasShortComposition1Column) {
    searchClauses.push("short_composition1 ILIKE $1");
  }

  if (hasShortComposition2Column) {
    searchClauses.push("short_composition2 ILIKE $1");
  }

  if (hasSaltCompositionColumn) {
    searchClauses.push("salt_composition ILIKE $1");
  }

  const clauses = [
    `(${searchClauses.join(" OR ")})`,
  ];

  if (await medicinesHasIsDeletedColumn()) {
    clauses.unshift("is_deleted = false");
  }

  return sql.query(
    `
      SELECT
        id,
        name,
        salt,
        short_composition1,
        short_composition2,
        manufacturer_name,
        type,
        pack_size_label,
        price,
        image
      FROM ${tableName}
      WHERE ${clauses.join(" AND ")}
      ORDER BY
        CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END,
        name ASC,
        id ASC
      LIMIT 10
    `,
    [pattern],
  );
}

export async function getMedicineFiltersFromDb() {
  const tableName = await getMedicineTableName();
  const [
    hasIsDeletedColumn,
    hasChemicalClassColumn,
    hasTherapeuticClassColumn,
    hasActionClassColumn,
    hasCategoryColumn,
  ] = await Promise.all([
    medicinesHasIsDeletedColumn(),
    medicineHasColumn("chemical_class"),
    medicineHasColumn("therapeutic_class"),
    medicineHasColumn("action_class"),
    medicineHasColumn("category"),
  ]);

  const baseClauses = [];
  if (hasIsDeletedColumn) {
    baseClauses.push("is_deleted = false");
  }

  const buildWhereClause = (columnName) =>
    [...baseClauses, `${columnName} IS NOT NULL`, `TRIM(${columnName}) <> ''`].join(
      " AND ",
    );

  const [chemicalClasses, therapeuticClasses, actionClasses, categories] =
    await Promise.all([
      hasChemicalClassColumn
        ? sql.query(
        `
          SELECT DISTINCT chemical_class
          FROM ${tableName}
          WHERE ${buildWhereClause("chemical_class")}
          ORDER BY chemical_class ASC
        `,
      )
        : Promise.resolve([]),
      hasTherapeuticClassColumn
        ? sql.query(
        `
          SELECT DISTINCT therapeutic_class
          FROM ${tableName}
          WHERE ${buildWhereClause("therapeutic_class")}
          ORDER BY therapeutic_class ASC
        `,
      )
        : Promise.resolve([]),
      hasActionClassColumn
        ? sql.query(
        `
          SELECT DISTINCT action_class
          FROM ${tableName}
          WHERE ${buildWhereClause("action_class")}
          ORDER BY action_class ASC
        `,
      )
        : Promise.resolve([]),
      hasCategoryColumn
        ? sql.query(
        `
          SELECT DISTINCT category
          FROM ${tableName}
          WHERE ${buildWhereClause("category")}
          ORDER BY category ASC
        `,
      )
        : Promise.resolve([]),
    ]);

  return {
    chemical_class: chemicalClasses.map((item) => item.chemical_class),
    therapeutic_class: therapeuticClasses.map((item) => item.therapeutic_class),
    action_class: actionClasses.map((item) => item.action_class),
    category: categories.map((item) => item.category),
  };
}

export async function getMedicineSubstitutesFromDb(id) {
  const medicine = await getMedicineByIdFromDb(id);
  if (!medicine) {
    return null;
  }

  return medicine.substitute_details ?? [];
}

export async function getMedicineSideEffectsFromDb(id) {
  const medicine = await getMedicineByIdFromDb(id);
  return medicine ? medicine.side_effects : null;
}

export async function getMedicineUsesFromDb(id) {
  const medicine = await getMedicineByIdFromDb(id);
  return medicine ? medicine.uses : null;
}
