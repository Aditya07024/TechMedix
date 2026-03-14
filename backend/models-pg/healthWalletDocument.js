import sql from "../config/database.js";

let initPromise;

const ensureTable = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS health_wallet_documents (
          id SERIAL PRIMARY KEY,
          patient_id TEXT NOT NULL,
          public_id TEXT NOT NULL,
          file_url TEXT NOT NULL,
          file_name TEXT NOT NULL,
          resource_type TEXT NOT NULL DEFAULT 'raw',
          format TEXT,
          bytes INTEGER,
          mime_type TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE
        )
      `;

      await sql`
        ALTER TABLE health_wallet_documents
        ALTER COLUMN patient_id TYPE TEXT USING patient_id::text
      `;
    })();
  }

  await initPromise;
};

export const createHealthWalletDocument = async (data) => {
  await ensureTable();

  const result = await sql`
    INSERT INTO health_wallet_documents (
      patient_id,
      public_id,
      file_url,
      file_name,
      resource_type,
      format,
      bytes,
      mime_type
    )
    VALUES (
      ${data.patient_id},
      ${data.public_id},
      ${data.file_url},
      ${data.file_name},
      ${data.resource_type},
      ${data.format},
      ${data.bytes},
      ${data.mime_type}
    )
    RETURNING *
  `;

  return result[0];
};

export const getHealthWalletDocumentsByPatientId = async (patientId) => {
  await ensureTable();

  return sql`
    SELECT *
    FROM health_wallet_documents
    WHERE patient_id = ${patientId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;
};

export const getHealthWalletDocumentById = async (id) => {
  await ensureTable();

  const result = await sql`
    SELECT *
    FROM health_wallet_documents
    WHERE id = ${id}
      AND is_deleted = FALSE
  `;

  return result[0] || null;
};

export const deleteHealthWalletDocument = async (id) => {
  await ensureTable();

  const result = await sql`
    UPDATE health_wallet_documents
    SET is_deleted = TRUE
    WHERE id = ${id}
      AND is_deleted = FALSE
    RETURNING *
  `;

  return result[0] || null;
};
