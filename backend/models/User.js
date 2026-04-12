import sql from "../config/database.js";

/*
  CREATE USER
*/
export const createUser = async (data) => {
  try {
    const result = await sql`
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        phone,
        date_of_birth,
        allergies,
        medical_conditions,
        role,
        created_at
      )
      VALUES (
        ${data.email},
        ${data.password_hash},
        ${data.full_name},
        ${data.phone || null},
        ${data.date_of_birth || null},
        ${data.allergies || []},
        ${data.medical_conditions || []},
        ${data.role || 'patient'},
        NOW()
      )
      RETURNING id, email, full_name, role
    `;

    return result[0];

  } catch (error) {
    if (error.code === "23505") {
      // duplicate email
      return { error: "Email already registered" };
    }

    console.error("Create user failed:", error);
    return null;
  }
};


/*
  GET USER BY ID
*/
export const getUserById = async (id) => {
  try {
    const result = await sql`
      SELECT id, email, full_name, phone, role,
             date_of_birth, allergies, medical_conditions
      FROM users
      WHERE id = ${id}
    `;
    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Get user by ID failed:", error);
    return null;
  }
};


/*
  GET USER BY EMAIL (Used for Login)
*/
export const getUserByEmail = async (email) => {
  try {
    const result = await sql`
      SELECT *
      FROM users
      WHERE email = ${email}
        AND COALESCE(is_deleted, FALSE) = FALSE
    `;
    return result.length ? result[0] : null;

  } catch (error) {
    console.error("Get user by email failed:", error);
    return null;
  }
};

export const updateUserById = async (id, data) => {
  try {
    const email = data?.email ?? null;
    const fullName = data?.full_name ?? null;
    const phone = data?.phone ?? null;

    const result = await sql`
      UPDATE users
      SET email = COALESCE(${email}, email),
          full_name = COALESCE(${fullName}, full_name),
          phone = COALESCE(${phone}, phone),
          updated_at = NOW()
      WHERE id = ${id}
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING id, email, full_name, phone, role, created_at, updated_at
    `;

    return result[0] || null;
  } catch (error) {
    console.error("Update user failed:", error);
    return null;
  }
};

export const deleteUserById = async (id) => {
  try {
    const result = await sql`
      UPDATE users
      SET is_deleted = TRUE,
          updated_at = NOW()
      WHERE id = ${id}
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING id
    `;

    return result[0] || null;
  } catch (error) {
    console.error("Delete user failed:", error);
    return null;
  }
};
