import sql from "../config/database.js";

export const createMedicine = async (medicineData) => {
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
    image = "https://img1.exportersindia.com/product_images/bc-full/2022/1/1169423/warfarin-sodium-tablets-1642579071-6164622.jpeg",
    link,
  } = medicineData;

  const result = await sql`
    INSERT INTO medicines (name, salt, price, info, benefits, sideeffects, usage, working, safetyadvice, image, link)
    VALUES (${name}, ${salt}, ${price}, ${info}, ${benefits}, ${sideeffects}, ${usage}, ${working}, ${safetyadvice}, ${image}, ${link})
    RETURNING *
  `;
  return result[0];
};

export const getMedicineById = async (id) => {
  const result = await sql`
    SELECT * FROM medicines WHERE id = ${id}
  `;
  return result[0];
};

export const getAllMedicines = async () => {
  const result = await sql`
    SELECT * FROM medicines ORDER BY created_at DESC
  `;
  return result;
};

export const updateMedicine = async (id, medicineData) => {
  const fields = [];
  const values = [];
  let index = 0;

  Object.entries(medicineData).forEach(([key, value]) => {
    if (value !== undefined && key !== "id") {
      fields.push(`${key} = $${++index}`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    return getMedicineById(id);
  }

  values.push(id);
  const query = `UPDATE medicines SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${++index} RETURNING *`;

  const result = await sql(query, values);
  return result[0];
};

export const deleteMedicine = async (id) => {
  const result = await sql`
    DELETE FROM medicines WHERE id = ${id} RETURNING id
  `;
  return result[0];
};

export const searchMedicines = async (searchTerm) => {
  const pattern = `%${searchTerm}%`;
  const result = await sql`
    SELECT * FROM medicines 
    WHERE name ILIKE ${pattern} OR salt ILIKE ${pattern} OR benefits ILIKE ${pattern}
    ORDER BY created_at DESC
  `;
  return result;
};
