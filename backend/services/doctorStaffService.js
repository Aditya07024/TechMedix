import bcrypt from "bcrypt";
import sql from "../config/database.js";

export async function createStaffForDoctor({
  doctorId,
  name,
  email,
  username = null,
  password,
  role = "assistant",
  department = null,
  phone = null,
}) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const normalizedUsername = username ? String(username).trim() : normalizedEmail;
  const cleanPassword = String(password || "").trim();

  if (!doctorId || !name || !normalizedEmail || !cleanPassword) {
    throw new Error("doctorId, name, email and password are required");
  }

  return sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id FROM staff
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;

    if (existing.length) {
      throw new Error("Staff email already exists");
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const userRows = await tx`
      INSERT INTO users (email, password_hash, full_name, phone, role)
      VALUES (${normalizedEmail}, ${passwordHash}, ${name}, ${phone}, 'staff')
      RETURNING id
    `;

    const staffRows = await tx`
      INSERT INTO staff (
        user_id,
        name,
        email,
        username,
        password_hash,
        role,
        department,
        phone,
        created_by_doctor_id,
        active_doctor_id
      )
      VALUES (
        ${userRows[0].id},
        ${name},
        ${normalizedEmail},
        ${normalizedUsername},
        ${passwordHash},
        ${role},
        ${department},
        ${phone},
        ${doctorId},
        ${doctorId}
      )
      RETURNING id, user_id, name, email, username, role, department, phone, active_doctor_id, created_by_doctor_id, created_at
    `;

    const staff = staffRows[0];

    await tx`
      INSERT INTO doctor_staff_map (doctor_id, staff_id, role, status)
      VALUES (${doctorId}, ${staff.id}, ${role}, 'active')
    `;

    return staff;
  });
}

export async function getDoctorStaff(doctorId) {
  return sql`
    SELECT
      s.id,
      s.user_id,
      s.name,
      s.email,
      s.username,
      s.department,
      s.phone,
      dsm.role AS assignment_role,
      dsm.status,
      dsm.created_at
    FROM doctor_staff_map dsm
    JOIN staff s ON s.id = dsm.staff_id
    WHERE dsm.doctor_id = ${doctorId}
    ORDER BY dsm.created_at DESC
  `;
}

export async function removeDoctorStaffAccess(doctorId, staffId) {
  const removed = await sql`
    DELETE FROM doctor_staff_map
    WHERE doctor_id = ${doctorId}
      AND staff_id = ${staffId}
    RETURNING id
  `;

  if (!removed.length) {
    throw new Error("Staff mapping not found");
  }

  const fallback = await sql`
    SELECT doctor_id
    FROM doctor_staff_map
    WHERE staff_id = ${staffId}
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1
  `;

  await sql`
    UPDATE staff
    SET active_doctor_id = ${fallback[0]?.doctor_id || null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${staffId}
      AND active_doctor_id = ${doctorId}
  `;

  return { success: true };
}

export async function staffHasDoctorAccess(staffId, doctorId) {
  const rows = await sql`
    SELECT id
    FROM doctor_staff_map
    WHERE staff_id = ${staffId}
      AND doctor_id = ${doctorId}
      AND status = 'active'
    LIMIT 1
  `;

  return rows.length > 0;
}

export async function getStaffDoctors(staffId) {
  return sql`
    SELECT
      d.id,
      d.name,
      d.specialty,
      d.branch_id,
      dsm.role AS assignment_role,
      dsm.status,
      s.active_doctor_id
    FROM doctor_staff_map dsm
    JOIN doctors d ON d.id = dsm.doctor_id
    JOIN staff s ON s.id = dsm.staff_id
    WHERE dsm.staff_id = ${staffId}
      AND dsm.status = 'active'
    ORDER BY d.name ASC
  `;
}

export async function switchStaffDoctor(staffId, doctorId) {
  const hasAccess = await staffHasDoctorAccess(staffId, doctorId);
  if (!hasAccess) {
    throw new Error("Staff is not assigned to this doctor");
  }

  const rows = await sql`
    UPDATE staff
    SET active_doctor_id = ${doctorId},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${staffId}
    RETURNING id, active_doctor_id
  `;

  return rows[0];
}
