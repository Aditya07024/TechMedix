import sql from "../config/database.js";

export const createPatientData = async (patientDataInput) => {
  const {
    patientId,
    email,
    symptoms,
    bloodPressureSystolic,
    bloodPressureDiastolic,
    heartRate,
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
    aiInsights,
    predictedDisease,
    confidence,
    relatedSymptoms,
  } = patientDataInput;

  const result = await sql`
    INSERT INTO patient_data (
      patient_id, email, symptoms, blood_pressure_systolic, blood_pressure_diastolic,
      heart_rate, glucose, cholesterol, temperature, spo2, bmi, weight, sleep, steps,
      medicines, prescription, ai_insights, predicted_disease, confidence, related_symptoms
    ) VALUES (
      ${patientId}, ${email}, ${JSON.stringify(symptoms)}, ${bloodPressureSystolic}, ${bloodPressureDiastolic},
      ${heartRate}, ${glucose}, ${cholesterol}, ${temperature}, ${spo2}, ${bmi}, ${weight}, ${sleep}, ${steps},
      ${JSON.stringify(medicines)}, ${JSON.stringify(prescription)}, ${aiInsights}, ${predictedDisease}, ${confidence}, ${relatedSymptoms}
    )
    RETURNING *
  `;

  return result[0];
};

export const getPatientDataById = async (id) => {
  const result = await sql`
    SELECT * FROM patient_data WHERE id = ${id}
  `;
  return result[0];
};

export const getPatientDataByPatientId = async (patientId) => {
  const result = await sql`
    SELECT * FROM patient_data WHERE patient_id = ${patientId} ORDER BY created_at DESC
  `;
  return result;
};

export const updatePatientData = async (id, patientDataInput) => {
  const fields = [];
  const values = [];
  let index = 0;

  Object.entries(patientDataInput).forEach(([key, value]) => {
    if (value !== undefined && key !== "id") {
      const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      fields.push(`${dbKey} = $${++index}`);

      // Convert objects to JSON strings
      if (typeof value === "object" && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  });

  if (fields.length === 0) {
    return getPatientDataById(id);
  }

  values.push(id);
  const query = `UPDATE patient_data SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${++index} RETURNING *`;

  const result = await sql(query, values);
  return result[0];
};

export const deletePatientData = async (id) => {
  const result = await sql`
    DELETE FROM patient_data WHERE id = ${id} RETURNING id
  `;
  return result[0];
};

export const deletePatientDataByPatientId = async (patientId) => {
  await sql`DELETE FROM patient_data WHERE patient_id = ${patientId}`;
};

export const getPatientDataByEmail = async (email) => {
  const result = await sql`
    SELECT * FROM patient_data WHERE email = ${email} ORDER BY created_at DESC
  `;
  return result;
};
