import sql from "../config/database.js";

export async function getOrCreateWallet(patientId) {
  const existing = await sql`
    SELECT * FROM wallets WHERE patient_id = ${patientId}
  `;
  if (existing.length) return existing[0];
  const created = await sql`
    INSERT INTO wallets (patient_id, balance)
    VALUES (${patientId}, 0)
    RETURNING *
  `;
  return created[0];
}

export async function creditWallet({ patientId, amount, source, referenceId, note }) {
  if (!amount || Number(amount) <= 0) throw new Error("Invalid credit amount");

  const wallet = await sql`
    INSERT INTO wallets (patient_id, balance)
    VALUES (${patientId}, 0)
    ON CONFLICT (patient_id)
    DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;

  const updated = await sql`
    UPDATE wallets
    SET balance = balance + ${amount}, updated_at = NOW()
    WHERE id = ${wallet[0].id}
    RETURNING *
  `;

  await sql`
    INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, reference_id, note)
    VALUES (${updated[0].id}, ${patientId}, 'credit', ${amount}, ${source || null}, ${referenceId || null}, ${note || null})
  `;

  return updated[0];
}

export async function debitWallet({ patientId, amount, source, referenceId, note }) {
  if (!amount || Number(amount) <= 0) throw new Error("Invalid debit amount");

  // Conditional update to prevent overdraft without explicit transaction
  const updated = await sql`
    UPDATE wallets
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE patient_id = ${patientId}
      AND balance >= ${amount}
    RETURNING id, balance
  `;
  if (!updated.length) throw new Error("Insufficient wallet balance");

  await sql`
    INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, reference_id, note)
    VALUES (${updated[0].id}, ${patientId}, 'debit', ${amount}, ${source || null}, ${referenceId || null}, ${note || null})
  `;

  return updated[0];
}

export async function getWalletBalance(patientId) {
  const w = await sql`SELECT balance FROM wallets WHERE patient_id = ${patientId}`;
  return w.length ? Number(w[0].balance) : 0;
}
