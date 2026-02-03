import sql from "../config/database.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const createPatient = async (patientData) => {
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
  const uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();

  const result = await sql`
    INSERT INTO patients (name, email, password, age, gender, phone, blood_group, medical_history, unique_code)
    VALUES (${name}, ${email}, ${hashedPassword}, ${age}, ${gender}, ${phone}, ${bloodGroup}, ${medicalHistory}, ${uniqueCode})
    RETURNING id, name, email, age, gender, phone, blood_group, medical_history, unique_code, created_at
  `;
  return result[0];
};

export const getPatientById = async (id) => {
  const result = await sql`
    SELECT id, name, email, age, gender, phone, blood_group, medical_history, unique_code, created_at 
    FROM patients WHERE id = ${id}
  `;
  return result[0];
};

export const getPatientByEmail = async (email) => {
  const result = await sql`
    SELECT * FROM patients WHERE email = ${email}
  `;
  return result[0];
};

export const getPatientByUniqueCode = async (uniqueCode) => {
  const result = await sql`
    SELECT id, name, email, age, gender, phone, blood_group, medical_history, unique_code, created_at 
    FROM patients WHERE unique_code = ${uniqueCode}
  `;
  return result[0];
};

export const updatePatient = async (id, patientData) => {
  const updates = [];
  const values = [];

  Object.entries(patientData).forEach(([key, value]) => {
    if (value !== undefined && key !== "password" && key !== "id") {
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      updates.push(`${dbKey} = \${values[${values.length}]}`);
      values.push(value);
    }
  });

  if (updates.length === 0) return null;

  // Build dynamic SQL for update - NOTE: This is complex with Neon, using safer approach
  let updateFields = "";
  values.forEach((_, i) => {
    const key = Object.keys(patientData)[i];
    if (key && key !== "password" && key !== "id") {
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      updateFields += `${dbKey} = ${i > 0 ? "," : ""} `;
    }
  });

  const query = `UPDATE patients SET ${updateFields.trim()}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1} RETURNING *`;
  const result = await sql(query, [...values, id]);
  return result[0];
};

export const deletePatient = async (id) => {
  const result = await sql`
    DELETE FROM patients WHERE id = ${id} RETURNING id
  `;
  return result[0];
};

export const comparePassword = async (candidatePassword, hashedPassword) => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

export const getAllPatients = async () => {
  const result = await sql`
    SELECT id, name, email, age, gender, phone, blood_group, medical_history, unique_code, created_at 
    FROM patients ORDER BY created_at DESC
  `;
  return result;
};
