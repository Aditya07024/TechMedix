import sql from "../config/database.js";

/*
  CREATE PATIENT DATA (Medical Record Entry)
*/
export const createPatientData = async (data) => {
  // Filter symptoms to only include selected ones (value === 1)
  const selectedSymptoms = Object.entries(data.symptoms || {})
    .filter(([_, value]) => value === 1)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  const result = await sql`
    INSERT INTO patient_data (
      patient_id,
      email,
      symptoms,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      heart_rate,
      glucose,
      cholesterol,
      temperature,
      spo2,
      bmi,
      weight,
      sleep,
      steps,
      medicines,
      prescription,
      ai_insights,
      predicted_disease,
      confidence,
      related_symptoms,
      created_at,
      is_deleted
    )
    VALUES (
      ${data.patientId},
      ${data.email},
      ${JSON.stringify(selectedSymptoms)},
      ${data.bloodPressureSystolic},
      ${data.bloodPressureDiastolic},
      ${data.heartRate},
      ${data.glucose},
      ${data.cholesterol},
      ${data.temperature},
      ${data.spo2},
      ${data.bmi},
      ${data.weight},
      ${data.sleep},
      ${data.steps},
      ${JSON.stringify(data.medicines || [])},
      ${JSON.stringify(data.prescription || [])},
      ${data.aiInsights},
      ${data.predictedDisease},
      ${data.confidence},
      ${JSON.stringify(data.relatedSymptoms || [])},
      NOW(),
      FALSE
    )
    RETURNING *
  `;

  return result[0];
};

/*
  GET BY RECORD ID
*/
export const getPatientDataById = async (id) => {
  const result = await sql`
    SELECT *
    FROM patient_data
    WHERE id = ${id}
      AND is_deleted = FALSE
  `;
  return result.length ? result[0] : null;
};

/*
  GET ALL DATA FOR PATIENT
*/
export const getPatientDataByPatientId = async (patientId) => {
  return await sql`
    SELECT *
    FROM patient_data
    WHERE patient_id = ${patientId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};

/*
  SAFE UPDATE
*/
export const updatePatientData = async (id, data) => {
  const result = await sql`
    UPDATE patient_data
    SET symptoms = COALESCE(${data.symptoms}, symptoms),
        blood_pressure_systolic = COALESCE(${data.bloodPressureSystolic}, blood_pressure_systolic),
        blood_pressure_diastolic = COALESCE(${data.bloodPressureDiastolic}, blood_pressure_diastolic),
        heart_rate = COALESCE(${data.heartRate}, heart_rate),
        glucose = COALESCE(${data.glucose}, glucose),
        cholesterol = COALESCE(${data.cholesterol}, cholesterol),
        temperature = COALESCE(${data.temperature}, temperature),
        spo2 = COALESCE(${data.spo2}, spo2),
        bmi = COALESCE(${data.bmi}, bmi),
        weight = COALESCE(${data.weight}, weight),
        sleep = COALESCE(${data.sleep}, sleep),
        steps = COALESCE(${data.steps}, steps),
        medicines = COALESCE(${data.medicines}, medicines),
        prescription = COALESCE(${data.prescription}, prescription),
        ai_insights = COALESCE(${data.aiInsights}, ai_insights),
        predicted_disease = COALESCE(${data.predictedDisease}, predicted_disease),
        confidence = COALESCE(${data.confidence}, confidence),
        related_symptoms = COALESCE(${data.relatedSymptoms}, related_symptoms),
        updated_at = NOW()
    WHERE id = ${id}
      AND is_deleted = FALSE
    RETURNING *
  `;

  return result.length ? result[0] : null;
};

/*
  SOFT DELETE SINGLE RECORD
*/
export const deletePatientData = async (id) => {
  const result = await sql`
    UPDATE patient_data
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  return result.length ? result[0] : null;
};

/*
  SOFT DELETE ALL DATA FOR PATIENT
*/
export const deletePatientDataByPatientId = async (patientId) => {
  await sql`
    UPDATE patient_data
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE patient_id = ${patientId}
  `;
};

/*
  GET BY EMAIL
*/
export const getPatientDataByEmail = async (email) => {
  return await sql`
    SELECT *
    FROM patient_data
    WHERE email = ${email}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};