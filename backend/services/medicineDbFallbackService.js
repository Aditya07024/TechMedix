import sql from "../config/database.js";

let medicinesHasIsDeletedColumnPromise;
let medicineColumnsPromise;
const tableExistsPromiseCache = new Map();

async function medicinesHasIsDeletedColumn() {
  if (!medicinesHasIsDeletedColumnPromise) {
    medicinesHasIsDeletedColumnPromise = sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'medicines'
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
    medicineColumnsPromise = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'medicines'
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

async function tableExists(tableName) {
  if (!tableExistsPromiseCache.has(tableName)) {
    tableExistsPromiseCache.set(
      tableName,
      sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ${tableName}
        ) AS exists
      `
        .then((rows) => rows[0]?.exists === true)
        .catch((error) => {
          tableExistsPromiseCache.delete(tableName);
          throw error;
        }),
    );
  }

  return tableExistsPromiseCache.get(tableName);
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

async function buildSubstituteLookupQuery(names) {
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
      FROM medicines
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
  const clauses = [];
  const params = [];
  const [
    hasIsDeletedColumn,
    hasSaltColumn,
    hasChemicalClassColumn,
    hasTherapeuticClassColumn,
    hasActionClassColumn,
    hasCategoryColumn,
    hasHabitFormingColumn,
    selectList,
  ] = await Promise.all([
    medicinesHasIsDeletedColumn(),
    medicineHasColumn("salt"),
    medicineHasColumn("chemical_class"),
    medicineHasColumn("therapeutic_class"),
    medicineHasColumn("action_class"),
    medicineHasColumn("category"),
    medicineHasColumn("habit_forming"),
    buildMedicineSelect([
      "id",
      "name",
      "salt",
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

  if (saltSearch && hasSaltColumn) {
    const placeholder = pushParam(`%${saltSearch}%`);
    clauses.push(`salt ILIKE ${placeholder}`);
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
    `SELECT COUNT(*)::int AS total FROM medicines WHERE ${whereClause}`,
    params,
  );
  const total = countRows[0]?.total ?? 0;

  const offset = (page - 1) * limit;
  const dataParams = [...params, limit, offset];
  const rows = await sql.query(
    `
      SELECT
        ${selectList}
      FROM medicines
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
  const selectList = await buildMedicineSelect([
    "id",
    "name",
    "salt",
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
  const whereClauses = ["id = $1"];
  if (await medicinesHasIsDeletedColumn()) {
    whereClauses.push("is_deleted = false");
  }

  const rows = await sql`
    SELECT
      ${sql.unsafe(selectList)}
    FROM medicines
    WHERE ${sql.unsafe(whereClauses.join(" AND "), [id])}
    LIMIT 1
  `;

  const medicine = rows[0] ?? null;
  if (!medicine) {
    return null;
  }

  const [hasSaltsTable, hasSubstitutesTable, hasSideEffectsTable, hasUsesTable] =
    await Promise.all([
      tableExists("medicine_salts"),
      tableExists("medicine_substitutes"),
      tableExists("medicine_side_effects"),
      tableExists("medicine_uses"),
    ]);

  const [salts, substitutes, sideEffects, uses] = await Promise.all([
    hasSaltsTable
      ? sql`
          SELECT salt_name
          FROM medicine_salts
          WHERE medicine_id = ${id}
          ORDER BY salt_name ASC
        `
      : Promise.resolve([]),
    hasSubstitutesTable
      ? sql`
          SELECT substitute_name
          FROM medicine_substitutes
          WHERE medicine_id = ${id}
          ORDER BY substitute_name ASC
        `
      : Promise.resolve([]),
    hasSideEffectsTable
      ? sql`
          SELECT side_effect
          FROM medicine_side_effects
          WHERE medicine_id = ${id}
          ORDER BY id ASC
        `
      : Promise.resolve([]),
    hasUsesTable
      ? sql`
          SELECT "use"
          FROM medicine_uses
          WHERE medicine_id = ${id}
          ORDER BY id ASC
        `
      : Promise.resolve([]),
  ]);

  const substituteNames = [
    ...new Set(
      substitutes.map((item) => item.substitute_name?.trim()).filter(Boolean),
    ),
  ];

  let substituteDetails = [];
  const substituteQuery = await buildSubstituteLookupQuery(substituteNames);
  if (substituteQuery) {
    substituteDetails = await sql.query(
      substituteQuery.query,
      substituteQuery.params,
    );
  }

  return {
    ...medicine,
    salts: salts.map((item) => item.salt_name),
    substitutes: substituteNames,
    substitute_details: substituteDetails,
    side_effects: sideEffects.map((item) => item.side_effect),
    uses: uses.map((item) => item.use),
  };
}

export async function searchMedicinesInDb(query) {
  const pattern = `%${query}%`;
  const hasSaltColumn = await medicineHasColumn("salt");
  const clauses = [
    hasSaltColumn
      ? "(name ILIKE $1 OR salt ILIKE $1)"
      : "(name ILIKE $1)",
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
        price,
        image
      FROM medicines
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
          FROM medicines
          WHERE ${buildWhereClause("chemical_class")}
          ORDER BY chemical_class ASC
        `,
      )
        : Promise.resolve([]),
      hasTherapeuticClassColumn
        ? sql.query(
        `
          SELECT DISTINCT therapeutic_class
          FROM medicines
          WHERE ${buildWhereClause("therapeutic_class")}
          ORDER BY therapeutic_class ASC
        `,
      )
        : Promise.resolve([]),
      hasActionClassColumn
        ? sql.query(
        `
          SELECT DISTINCT action_class
          FROM medicines
          WHERE ${buildWhereClause("action_class")}
          ORDER BY action_class ASC
        `,
      )
        : Promise.resolve([]),
      hasCategoryColumn
        ? sql.query(
        `
          SELECT DISTINCT category
          FROM medicines
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
