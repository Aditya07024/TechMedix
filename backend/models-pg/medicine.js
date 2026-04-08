import sql from "../config/database.js";

let medicinesHasIsDeletedColumnPromise;

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

/*
  CREATE MEDICINE
*/
export const createMedicine = async (medicineData) => {
  try {
    const {
      name,
      salt,
      price,
      info,
      benefits,
      sideeffects,
      usage,
      working,
      safetyadvice,
      image,
      link,
    } = medicineData;

    const hasIsDeletedColumn = await medicinesHasIsDeletedColumn();
    const columns = [
      "name",
      "salt",
      "price",
      "info",
      "benefits",
      "sideeffects",
      "usage",
      "working",
      "safetyadvice",
      "image",
      "link",
      "created_at",
    ];
    const values = [
      name,
      salt,
      price,
      info,
      benefits,
      sideeffects,
      usage,
      working,
      safetyadvice,
      image || null,
      link || null,
      new Date(),
    ];

    if (hasIsDeletedColumn) {
      columns.push("is_deleted");
      values.push(false);
    }

    const columnList = columns.join(", ");
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const result = await sql.query(
      `
        INSERT INTO medicines (${columnList})
        VALUES (${placeholders})
        RETURNING *
      `,
      values,
    );

    return result[0];

  } catch (error) {
    if (error.code === "23505") {
      return { error: "Medicine already exists" };
    }
    console.error("Create medicine failed:", error);
    return null;
  }
};


/*
  GET MEDICINE BY ID (Soft Safe)
*/
export const getMedicineById = async (id) => {
  const clauses = ["id = $1"];
  if (await medicinesHasIsDeletedColumn()) {
    clauses.push("is_deleted = FALSE");
  }

  const result = await sql.query(
    `
      SELECT *
      FROM medicines
      WHERE ${clauses.join(" AND ")}
    `,
    [id],
  );
  return result[0];
};


/*
  GET ALL MEDICINES
*/
export const getAllMedicines = async () => {
  const clauses = [];
  if (await medicinesHasIsDeletedColumn()) {
    clauses.push("is_deleted = FALSE");
  }

  return sql.query(
    `
      SELECT *
      FROM medicines
      WHERE ${clauses.length > 0 ? clauses.join(" AND ") : "TRUE"}
      ORDER BY created_at DESC
    `,
  );
};


/*
  SAFE UPDATE
*/
export const updateMedicine = async (id, data) => {
  try {
    const clauses = ["id = $11"];
    if (await medicinesHasIsDeletedColumn()) {
      clauses.push("is_deleted = FALSE");
    }

    const result = await sql.query(
      `
        UPDATE medicines
        SET name = COALESCE($1, name),
            salt = COALESCE($2, salt),
            price = COALESCE($3, price),
            info = COALESCE($4, info),
            benefits = COALESCE($5, benefits),
            sideeffects = COALESCE($6, sideeffects),
            usage = COALESCE($7, usage),
            working = COALESCE($8, working),
            safetyadvice = COALESCE($9, safetyadvice),
            image = COALESCE($10, image),
            link = COALESCE($12, link),
            updated_at = NOW()
        WHERE ${clauses.join(" AND ")}
        RETURNING *
      `,
      [
        data.name,
        data.salt,
        data.price,
        data.info,
        data.benefits,
        data.sideeffects,
        data.usage,
        data.working,
        data.safetyadvice,
        data.image,
        id,
        data.link,
      ],
    );

    return result[0];

  } catch (error) {
    console.error("Update medicine failed:", error);
    return null;
  }
};


/*
  SOFT DELETE
*/
export const deleteMedicine = async (id) => {
  if (await medicinesHasIsDeletedColumn()) {
    const result = await sql.query(
      `
        UPDATE medicines
        SET is_deleted = TRUE,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );
    return result[0];
  }

  const result = await sql.query(
    `
      DELETE FROM medicines
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );
  return result[0];
};


/*
  SEARCH MEDICINES
*/
export const searchMedicines = async (searchTerm) => {
  const pattern = `%${searchTerm}%`;
  const clauses = [
    `(
      name ILIKE $1 OR
      salt ILIKE $1 OR
      benefits ILIKE $1 OR
      usage ILIKE $1 OR
      info ILIKE $1 OR
      therapeutic_class ILIKE $1 OR
      action_class ILIKE $1 OR
      chemical_class ILIKE $1
    )`,
  ];

  if (await medicinesHasIsDeletedColumn()) {
    clauses.unshift("is_deleted = FALSE");
  }

  return sql.query(
    `
      SELECT *
      FROM medicines
      WHERE ${clauses.join(" AND ")}
      ORDER BY
        CASE
          WHEN name ILIKE $2 THEN 1
          WHEN salt ILIKE $2 THEN 2
          WHEN benefits ILIKE $2 OR usage ILIKE $2 OR info ILIKE $2 THEN 3
          ELSE 4
        END,
        created_at DESC
    `,
    [pattern, searchTerm],
  );
};
