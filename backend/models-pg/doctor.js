import sql from "../config/database.js";
import bcrypt from "bcrypt";

/*
  CREATE DOCTOR
*/
export const createDoctor = async (doctorData) => {
  try {
    const { name, email, password, specialty, consultation_fee, branch_id } = doctorData;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await sql`
      INSERT INTO doctors (
        name,
        email,
        password,
        specialty,
        consultation_fee,
        branch_id,
        created_at,
        is_deleted
      )
      VALUES (
        ${name},
        ${email},
        ${hashedPassword},
        ${specialty},
        ${consultation_fee || 0},
        ${branch_id || null},
        NOW(),
        FALSE
      )
      RETURNING id, name, email, specialty, consultation_fee, branch_id, created_at
    `;

    return result[0];

  } catch (error) {
    if (error.code === "23505") {
      return { error: "Email already registered" };
    }
    console.error("Create doctor failed:", error);
    return null;
  }
};


/*
  GET DOCTOR BY ID (Soft Delete Safe)
*/
export const getDoctorById = async (id) => {
  try {
    const result = await sql`
      SELECT id, name, email, specialty,
             consultation_fee, branch_id, created_at
      FROM doctors
      WHERE id = ${id}
        AND is_deleted = FALSE
    `;
    return result.length ? result[0] : null;
  } catch (error) {
    console.error("Get doctor failed:", error);
    return null;
  }
};


/*
  GET DOCTOR BY EMAIL (Login)
*/
export const getDoctorByEmail = async (email) => {
  try {
    const result = await sql`
      SELECT *
      FROM doctors
      WHERE email = ${email}
        AND is_deleted = FALSE
    `;
    return result.length ? result[0] : null;
  } catch (error) {
    console.error("Get doctor by email failed:", error);
    return null;
  }
};


/*
  UPDATE DOCTOR (Safe Version)
*/
export const updateDoctor = async (id, doctorData) => {
  try {
    const { name, email, specialty, consultation_fee, branch_id } = doctorData;

    const result = await sql`
      UPDATE doctors
      SET name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          specialty = COALESCE(${specialty}, specialty),
          consultation_fee = COALESCE(${consultation_fee}, consultation_fee),
          branch_id = COALESCE(${branch_id}, branch_id),
          updated_at = NOW()
      WHERE id = ${id}
        AND is_deleted = FALSE
      RETURNING id, name, email, specialty, consultation_fee, branch_id
    `;

    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Update doctor failed:", error);
    return null;
  }
};


/*
  SOFT DELETE DOCTOR
*/
export const deleteDoctor = async (id) => {
  try {
    const result = await sql`
      UPDATE doctors
      SET is_deleted = TRUE,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    return result.length ? result[0] : null;
  } catch (error) {
    console.error("Delete doctor failed:", error);
    return null;
  }
};


/*
  PASSWORD COMPARE
*/
export const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};


/*
  GET ALL DOCTORS (Soft Delete Safe)
*/
export const getAllDoctors = async () => {
  try {
    return await sql`
      SELECT id, name, email, specialty,
             consultation_fee, branch_id, created_at
      FROM doctors
      WHERE is_deleted = FALSE
      ORDER BY created_at DESC
    `;
  } catch (error) {
    console.error("Fetch doctors failed:", error);
    return [];
  }
};