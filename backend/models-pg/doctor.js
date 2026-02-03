import sql from "../config/database.js";
import bcrypt from "bcrypt";

export const createDoctor = async (doctorData) => {
  const { name, email, password, specialty } = doctorData;
  const hashedPassword = await bcrypt.hash(password, 10); // It hashes here!

  const result = await sql`
    INSERT INTO doctors (name, email, password, specialty)
    VALUES (${name}, ${email}, ${hashedPassword}, ${specialty})
    RETURNING id, name, email, specialty, created_at
  `;
  return result[0];
};

export const getDoctorById = async (id) => {
  const result = await sql`
    SELECT id, name, email, specialty, created_at FROM doctors WHERE id = ${id}
  `;
  return result[0];
};

export const getDoctorByEmail = async (email) => {
  const result = await sql`
    SELECT * FROM doctors WHERE email = ${email}
  `;
  return result[0];
};

export const updateDoctor = async (id, doctorData) => {
  // Note: Dynamic updates with Neon SQL template literals are limited
  // For complex updates, consider using the sql function with raw query
  const fields = [];
  const values = [];
  let index = 0;

  Object.entries(doctorData).forEach(([key, value]) => {
    if (value !== undefined && key !== "password" && key !== "id") {
      fields.push(`${key} = $${++index}`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  values.push(id);
  const query = `UPDATE doctors SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${++index} RETURNING *`;
  const result = await sql(query, values);
  return result[0];
};

export const deleteDoctor = async (id) => {
  const result = await sql`
    DELETE FROM doctors WHERE id = ${id} RETURNING id
  `;
  return result[0];
};

export const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

export const getAllDoctors = async () => {
  const result = await sql`
    SELECT id, name, email, specialty, created_at FROM doctors ORDER BY created_at DESC
  `;
  return result;
};
