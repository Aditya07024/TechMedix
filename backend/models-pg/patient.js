import sql from "../config/database.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

/*
  CREATE PATIENT
*/
export const createPatient = async (patientData) => {
  try {
    const {
      name,
      email,
      password,
      age,
      gender,
      phone,
      bloodGroup,
      medicalHistory,
    } = patientData;

    const hashedPassword = await bcrypt.hash(password, 10);

    // generate unique code safely
    let uniqueCode;
    let exists = true;

    while (exists) {
      uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      const check = await sql`
        SELECT id FROM patients WHERE unique_code = ${uniqueCode}
      `;
      exists = check.length > 0;
    }

    const result = await sql`
      INSERT INTO patients (
        name,
        email,
        password,
        age,
        gender,
        phone,
        blood_group,
        medical_history,
        unique_code,
        created_at,
        is_deleted
      )
      VALUES (
        ${name},
        ${email},
        ${hashedPassword},
        ${age},
        ${gender},
        ${phone},
        ${bloodGroup},
        ${medicalHistory},
        ${uniqueCode},
        NOW(),
        FALSE
      )
      RETURNING id, name, email, age, gender, phone,
                blood_group, medical_history, unique_code, created_at
    `;

    return result[0];

  } catch (error) {
    if (error.code === "23505") {
      return { error: "Email already registered" };
    }
    console.error("Create patient failed:", error);
    return null;
  }
};


/*
  GET PATIENT BY ID
*/
export const getPatientById = async (id) => {
  const result = await sql`
    SELECT id, name, email, age, gender,
           phone, blood_group, medical_history,
           unique_code, created_at
    FROM patients
    WHERE id = ${id}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};


/*
  GET BY EMAIL (LOGIN)
*/
export const getPatientByEmail = async (email) => {
  const result = await sql`
    SELECT *
    FROM patients
    WHERE email = ${email}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};


/*
  GET BY UNIQUE CODE
*/
export const getPatientByUniqueCode = async (uniqueCode) => {
  const result = await sql`
    SELECT id, name, email, age, gender,
           phone, blood_group, medical_history,
           unique_code, created_at
    FROM patients
    WHERE unique_code = ${uniqueCode}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};


/*
  SAFE UPDATE
*/
export const updatePatient = async (id, data) => {
  const result = await sql`
    UPDATE patients
    SET name = COALESCE(${data.name}, name),
        email = COALESCE(${data.email}, email),
        age = COALESCE(${data.age}, age),
        gender = COALESCE(${data.gender}, gender),
        phone = COALESCE(${data.phone}, phone),
        blood_group = COALESCE(${data.bloodGroup}, blood_group),
        medical_history = COALESCE(${data.medicalHistory}, medical_history),
        updated_at = NOW()
    WHERE id = ${id}
      AND is_deleted = FALSE
    RETURNING id, name, email, age, gender,
              phone, blood_group, medical_history, unique_code
  `;

  return result.length ? result[0] : null;
};


/*
  SOFT DELETE
*/
export const deletePatient = async (id) => {
  const result = await sql`
    UPDATE patients
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length ? result[0] : null;
};


/*
  PASSWORD COMPARE
*/
export const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};


/*
  GET ALL PATIENTS
*/
export const getAllPatients = async () => {
  return await sql`
    SELECT id, name, email, age, gender,
           phone, blood_group, medical_history,
           unique_code, created_at
    FROM patients
    WHERE is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};