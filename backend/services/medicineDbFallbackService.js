import sql from "../config/database.js";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function buildSubstituteLookupQuery(names) {
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

  return {
    query: `
      SELECT DISTINCT ON (id)
        id,
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
        category,
        created_at,
        updated_at
      FROM medicines
      WHERE is_deleted = false
        AND (${clauses.join(" OR ")})
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
  const clauses = ["is_deleted = false"];
  const params = [];

  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (search) {
    const placeholder = pushParam(`%${search}%`);
    clauses.push(`name ILIKE ${placeholder}`);
  }

  if (saltSearch) {
    const placeholder = pushParam(`%${saltSearch}%`);
    clauses.push(`salt ILIKE ${placeholder}`);
  }

  if (chemicalClass) {
    const placeholder = pushParam(chemicalClass);
    clauses.push(`chemical_class = ${placeholder}`);
  }

  if (therapeuticClass) {
    const placeholder = pushParam(therapeuticClass);
    clauses.push(`therapeutic_class = ${placeholder}`);
  }

  if (actionClass) {
    const placeholder = pushParam(actionClass);
    clauses.push(`action_class = ${placeholder}`);
  }

  if (category) {
    const placeholder = pushParam(category);
    clauses.push(`category = ${placeholder}`);
  }

  const parsedHabitForming = parseBooleanFilter(habitForming);
  if (parsedHabitForming !== null) {
    const placeholder = pushParam(parsedHabitForming);
    clauses.push(`habit_forming = ${placeholder}`);
  }

  const whereClause = clauses.join(" AND ");

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
        id,
        name,
        salt,
        therapeutic_class,
        price,
        image,
        category,
        habit_forming
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
  const rows = await sql`
    SELECT
      id,
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
      category,
      created_at,
      updated_at
    FROM medicines
    WHERE id = ${id}
      AND is_deleted = false
    LIMIT 1
  `;

  const medicine = rows[0] ?? null;
  if (!medicine) {
    return null;
  }

  const [salts, substitutes, sideEffects, uses] = await Promise.all([
    sql`
      SELECT salt_name
      FROM medicine_salts
      WHERE medicine_id = ${id}
      ORDER BY salt_name ASC
    `,
    sql`
      SELECT substitute_name
      FROM medicine_substitutes
      WHERE medicine_id = ${id}
      ORDER BY substitute_name ASC
    `,
    sql`
      SELECT side_effect
      FROM medicine_side_effects
      WHERE medicine_id = ${id}
      ORDER BY id ASC
    `,
    sql`
      SELECT "use"
      FROM medicine_uses
      WHERE medicine_id = ${id}
      ORDER BY id ASC
    `,
  ]);

  const substituteNames = [
    ...new Set(
      substitutes.map((item) => item.substitute_name?.trim()).filter(Boolean),
    ),
  ];

  let substituteDetails = [];
  const substituteQuery = buildSubstituteLookupQuery(substituteNames);
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

  return sql`
    SELECT
      id,
      name,
      salt,
      price,
      image
    FROM medicines
    WHERE is_deleted = false
      AND (
        name ILIKE ${pattern}
        OR salt ILIKE ${pattern}
      )
    ORDER BY
      CASE WHEN name ILIKE ${pattern} THEN 0 ELSE 1 END,
      name ASC,
      id ASC
    LIMIT 10
  `;
}

export async function getMedicineFiltersFromDb() {
  const [chemicalClasses, therapeuticClasses, actionClasses, categories] =
    await Promise.all([
      sql`
        SELECT DISTINCT chemical_class
        FROM medicines
        WHERE is_deleted = false
          AND chemical_class IS NOT NULL
          AND TRIM(chemical_class) <> ''
        ORDER BY chemical_class ASC
      `,
      sql`
        SELECT DISTINCT therapeutic_class
        FROM medicines
        WHERE is_deleted = false
          AND therapeutic_class IS NOT NULL
          AND TRIM(therapeutic_class) <> ''
        ORDER BY therapeutic_class ASC
      `,
      sql`
        SELECT DISTINCT action_class
        FROM medicines
        WHERE is_deleted = false
          AND action_class IS NOT NULL
          AND TRIM(action_class) <> ''
        ORDER BY action_class ASC
      `,
      sql`
        SELECT DISTINCT category
        FROM medicines
        WHERE is_deleted = false
          AND category IS NOT NULL
          AND TRIM(category) <> ''
        ORDER BY category ASC
      `,
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
