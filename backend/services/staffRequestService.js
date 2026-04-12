import sql from "../config/database.js";

export async function createStaffDoctorRequest({ staffId, doctorId }) {
  if (!staffId || !doctorId) {
    throw new Error("staffId and doctorId are required");
  }

  return sql.begin(async (tx) => {
    const existingMap = await tx`
      SELECT id
      FROM doctor_staff_map
      WHERE staff_id = ${staffId}
        AND doctor_id = ${doctorId}
      LIMIT 1
    `;

    if (existingMap.length) {
      throw new Error("Staff is already linked to this doctor");
    }

    const existingRequest = await tx`
      SELECT id, status
      FROM staff_requests
      WHERE staff_id = ${staffId}
        AND doctor_id = ${doctorId}
      LIMIT 1
    `;

    if (!existingRequest.length) {
      const inserted = await tx`
        INSERT INTO staff_requests (staff_id, doctor_id, status)
        VALUES (${staffId}, ${doctorId}, 'pending')
        RETURNING *
      `;
      return inserted[0];
    }

    const updated = await tx`
      UPDATE staff_requests
      SET status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existingRequest[0].id}
      RETURNING *
    `;

    return updated[0];
  });
}

export async function getDoctorStaffRequests(doctorId) {
  return sql`
    SELECT
      sr.id,
      sr.staff_id,
      sr.doctor_id,
      sr.status,
      sr.created_at,
      s.name AS staff_name,
      s.email AS staff_email,
      s.department
    FROM staff_requests sr
    JOIN staff s ON s.id = sr.staff_id
    WHERE sr.doctor_id = ${doctorId}
      AND sr.status = 'pending'
    ORDER BY sr.created_at DESC
  `;
}

export async function resolveStaffRequest({ requestId, doctorId, status }) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Invalid status");
  }

  return sql.begin(async (tx) => {
    const requestRows = await tx`
      SELECT id, staff_id, doctor_id
      FROM staff_requests
      WHERE id = ${requestId}
        AND doctor_id = ${doctorId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      throw new Error("Request not found");
    }

    const updatedRequestRows = await tx`
      UPDATE staff_requests
      SET status = ${status},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
      RETURNING *
    `;

    if (status === "approved") {
      const existingMap = await tx`
        SELECT id
        FROM doctor_staff_map
        WHERE doctor_id = ${doctorId}
          AND staff_id = ${request.staff_id}
        LIMIT 1
      `;

      if (!existingMap.length) {
        await tx`
          INSERT INTO doctor_staff_map (doctor_id, staff_id, role, status)
          VALUES (${doctorId}, ${request.staff_id}, 'assistant', 'active')
        `;
      } else {
        await tx`
          UPDATE doctor_staff_map
          SET status = 'active',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingMap[0].id}
        `;
      }

      await tx`
        UPDATE staff
        SET active_doctor_id = COALESCE(active_doctor_id, ${doctorId}),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${request.staff_id}
      `;
    }

    return updatedRequestRows[0];
  });
}
