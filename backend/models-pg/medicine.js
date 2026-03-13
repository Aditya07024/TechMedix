import sql from "../config/database.js";

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

    const result = await sql`
      INSERT INTO medicines (
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
        created_at,
        is_deleted
      )
      VALUES (
        ${name},
        ${salt},
        ${price},
        ${info},
        ${benefits},
        ${sideeffects},
        ${usage},
        ${working},
        ${safetyadvice},
        ${image || null},
        ${link || null},
        NOW(),
        FALSE
      )
      RETURNING *
    `;

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
  const result = await sql`
    SELECT *
    FROM medicines
    WHERE id = ${id}
      AND is_deleted = FALSE
  `;
  return result[0];
};


/*
  GET ALL MEDICINES
*/
export const getAllMedicines = async () => {
  return await sql`
    SELECT *
    FROM medicines
    WHERE is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};


/*
  SAFE UPDATE
*/
export const updateMedicine = async (id, data) => {
  try {
    const result = await sql`
      UPDATE medicines
      SET name = COALESCE(${data.name}, name),
          salt = COALESCE(${data.salt}, salt),
          price = COALESCE(${data.price}, price),
          info = COALESCE(${data.info}, info),
          benefits = COALESCE(${data.benefits}, benefits),
          sideeffects = COALESCE(${data.sideeffects}, sideeffects),
          usage = COALESCE(${data.usage}, usage),
          working = COALESCE(${data.working}, working),
          safetyadvice = COALESCE(${data.safetyadvice}, safetyadvice),
          image = COALESCE(${data.image}, image),
          link = COALESCE(${data.link}, link),
          updated_at = NOW()
      WHERE id = ${id}
        AND is_deleted = FALSE
      RETURNING *
    `;

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
  const result = await sql`
    UPDATE medicines
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result[0];
};


/*
  SEARCH MEDICINES
*/
export const searchMedicines = async (searchTerm) => {
  const pattern = `%${searchTerm}%`;

  return await sql`
    SELECT *
    FROM medicines
    WHERE is_deleted = FALSE
      AND (
        name ILIKE ${pattern}
        OR salt ILIKE ${pattern}
        OR benefits ILIKE ${pattern}
      )
    ORDER BY created_at DESC
  `;
};