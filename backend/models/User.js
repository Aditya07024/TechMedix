import sql from "../config/database.js";

export const createUser = async (data) => {
  const result = await sql`
    INSERT INTO users (
      email, password_hash, full_name, phone,
      date_of_birth, allergies, medical_conditions
    ) VALUES (
      ${data.email},
      ${data.password_hash},
      ${data.full_name},
      ${data.phone},
      ${data.date_of_birth},
      ${data.allergies},
      ${data.medical_conditions}
    )
    RETURNING *
  `;
  return result[0];
};

export const getUserById = async (id) => {
  const res = await sql`SELECT * FROM users WHERE id = ${id}`;
  return res[0];
};

export const getUserByEmail = async (email) => {
  const res = await sql`SELECT * FROM users WHERE email = ${email}`;
  return res[0];
};