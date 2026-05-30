import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getPatientByEmail,
  createPatient,
  comparePassword,
  getPatientById,
  updatePatient,
  deletePatient,
  resetPatientUniqueCode,
} from "../models-pg/patient.js";
import { getUserById, updateUserById, deleteUserById } from "../models/User.js";
import {
  getDoctorById,
  updateDoctor,
  deleteDoctor,
} from "../models-pg/doctor.js";
import {
  getStaffProfile,
  updateStaffProfile,
  deleteStaffProfile,
} from "../services/staffService.js";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { OAuth2Client } from "google-auth-library";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let usersTableExistsPromise;

async function usersTableExists() {
  if (!usersTableExistsPromise) {
    usersTableExistsPromise = sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) AS exists
    `
      .then((rows) => rows[0]?.exists === true)
      .catch((error) => {
        console.warn("users table existence check failed:", error.message);
        usersTableExistsPromise = null;
        return false;
      });
  }

  return usersTableExistsPromise;
}

function mapUserProfileByRole(role, record) {
  if (!record) return null;

  if (role === "patient") {
    return {
      id: record.id,
      role: "patient",
      name: record.name,
      email: record.email,
      age: record.age ?? null,
      gender: record.gender ?? null,
      phone: record.phone ?? "",
      bloodGroup: record.blood_group ?? record.bloodGroup ?? null,
      medicalHistory: record.medical_history ?? record.medicalHistory ?? null,
      uniqueCode: record.unique_code ?? record.uniqueCode ?? null,
      createdAt: record.created_at ?? record.createdAt ?? null,
    };
  }

  if (role === "doctor") {
    return {
      id: record.id,
      role: "doctor",
      name: record.name,
      email: record.email,
      specialty: record.specialty ?? "",
      consultation_fee: Number(record.consultation_fee || 0),
      branch_id: record.branch_id ?? null,
      createdAt: record.created_at ?? record.createdAt ?? null,
    };
  }

  if (role === "staff") {
    return {
      id: record.user_id || record.id,
      staff_id: record.id,
      role: "staff",
      name: record.name,
      email: record.email,
      phone: record.phone ?? "",
      department: record.department ?? "",
      staff_role: record.role ?? "staff",
      hospital_id: record.hospital_id ?? null,
      active_doctor_id: record.active_doctor_id ?? null,
      createdAt: record.created_at ?? null,
    };
  }

  if (role === "admin" || record.role === "admin") {
    const adminEmail = process.env.ADMIN_EMAIL || "admintech@gmail.com";
    return {
      id: record.id,
      role: "admin",
      name: record.full_name || record.name || "Administrator",
      email: adminEmail,
      phone: record.phone ?? "",
      createdAt: record.created_at ?? record.createdAt ?? null,
    };
  }

  return {
    id: record.id,
    role: role || record.role || "admin",
    name: record.full_name || record.name || "",
    email: record.email,
    phone: record.phone ?? "",
    createdAt: record.created_at ?? record.createdAt ?? null,
  };
}

async function getCurrentProfile(user) {
  switch (user?.role) {
    case "patient":
      return mapUserProfileByRole("patient", await getPatientById(user.id));
    case "doctor":
      return mapUserProfileByRole("doctor", await getDoctorById(user.id));
    case "staff":
      return mapUserProfileByRole("staff", await getStaffProfile(user.id));
    case "admin": {
      const dbProfile = await getUserById(user.id);
      if (dbProfile) {
        return mapUserProfileByRole("admin", dbProfile);
      }
      return {
        id: user.id,
        role: "admin",
        name: "Administrator",
        email: user.email,
        phone: "",
        createdAt: new Date().toISOString(),
      };
    }
    default:
      return null;
  }
}

// Google OAuth login

// Signup
router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      age,
      gender,
      phone,
      address,
      bloodGroup,
      medicalHistory,
    } = req.body; // Added new fields
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required" });
    }
    let user = await getPatientByEmail(email);
    if (user) {
      console.log("User already exists with email:", email);
      return res.status(400).json({ error: "User already exists" });
    }

    // NOTE:
    // Password hashing is handled inside createPatient (models-pg/patient.js),
    // so we must pass the *plain* password here. Hashing again would result
    // in a double-hashed password and make login comparisons always fail.
    user = await createPatient({
      name,
      email,
      password,
      age,
      gender,
      phone,
      address,
      bloodGroup,
      medicalHistory,
    });
    console.log("New patient object after save:", user);

    res.json({ message: "Patient registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // 1️⃣ First check in users table (admin / future doctor roles)
    let users = [];

    if (await usersTableExists()) {
      try {
        users = await sql`
          SELECT * FROM users
          WHERE email = ${email}
            AND COALESCE(is_deleted, FALSE) = FALSE
        `;
      } catch (error) {
        console.warn("users table login lookup failed:", error.message);
        users = [];
      }
    }

    if (users.length) {
      const user = users[0];

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch)
        return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.TOKEN_SECRET,
        { expiresIn: "1d" },
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.json({
        ifLogin: true,
        role: user.role,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "admintech@gmail.com")
      .toLowerCase()
      .trim();
    const adminPassword = process.env.ADMIN_PASSWORD || "1234567890";

    if (
      email.toLowerCase().trim() === adminEmail &&
      password === adminPassword
    ) {
      const token = jwt.sign(
        { id: "admin", email: adminEmail, role: "admin" },
        process.env.TOKEN_SECRET,
        { expiresIn: "1d" },
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.json({
        ifLogin: true,
        role: "admin",
        token,
        user: {
          id: "admin",
          role: "admin",
          name: "Administrator",
          email: adminEmail,
        },
      });
    }

    // 2️⃣ Otherwise fallback to patient table login
    const patient = await getPatientByEmail(email);
    if (!patient) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await comparePassword(password, patient.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: patient.id, email: patient.email, role: "patient" },
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    const safeUser = {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address ?? null,
      bloodGroup: patient.blood_group ?? null,
      medicalHistory: patient.medical_history ?? null,
      uniqueCode: patient.unique_code ?? null,
      createdAt: patient.created_at ?? null,
    };

    return res.json({
      ifLogin: true,
      token,
      user: safeUser,
      role: "patient",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/logout", async (req, res) => {
  try {
    // Clear the cookie by setting an empty value and immediate expiry
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    console.log("logout successfully");
    return res.json({
      message: "Logged out successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get("/status", (req, res) => {
  const tokenFromCookie = req.cookies?.token;
  const authHeader = req.headers.authorization;
  const tokenFromHeader =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
  const token = tokenFromCookie || tokenFromHeader;
  if (!token) return res.json({ ifLogin: false });
  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    return res.json({ ifLogin: true, role: decoded.role, user: decoded });
  } catch {
    return res.json({ ifLogin: false });
  }
});

router.get("/profile", authenticate, async (req, res) => {
  try {
    const profile = await getCurrentProfile(req.user);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error("Profile fetch failed:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/profile", authenticate, async (req, res) => {
  try {
    let updated = null;

    if (req.user.role === "patient") {
      updated = await updatePatient(req.user.id, req.body);
      updated = mapUserProfileByRole("patient", updated);
    } else if (req.user.role === "doctor") {
      updated = await updateDoctor(req.user.id, {
        name: req.body.name,
        email: req.body.email,
        specialty: req.body.specialty,
        consultation_fee: req.body.consultation_fee,
      });
      updated = mapUserProfileByRole("doctor", updated);
    } else if (req.user.role === "staff") {
      updated = await updateStaffProfile(req.user.id, req.body);
      updated = mapUserProfileByRole("staff", updated);
    } else if (req.user.role === "admin") {
      updated = await updateUserById(req.user.id, {
        email: req.body.email,
        full_name: req.body.name || req.body.full_name,
        phone: req.body.phone,
      });
      updated = mapUserProfileByRole("admin", updated);
    }

    if (!updated) {
      return res.status(400).json({ error: "Profile update failed" });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Profile update failed:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to update profile" });
  }
});

router.post(
  "/profile/reset-qr",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const updated = await resetPatientUniqueCode(req.user.id);

      if (!updated) {
        return res.status(400).json({ error: "Failed to reset QR code" });
      }

      return res.json({
        success: true,
        data: mapUserProfileByRole("patient", updated),
      });
    } catch (error) {
      console.error("QR reset failed:", error);
      return res.status(500).json({ error: "Failed to reset QR code" });
    }
  },
);

router.delete("/profile", authenticate, async (req, res) => {
  try {
    let deleted = null;

    if (req.user.role === "patient") {
      deleted = await deletePatient(req.user.id);
    } else if (req.user.role === "doctor") {
      deleted = await deleteDoctor(req.user.id);
    } else if (req.user.role === "staff") {
      deleted = await deleteStaffProfile(req.user.id);
    } else if (req.user.role === "admin") {
      deleted = await deleteUserById(req.user.id);
    }

    if (!deleted) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Account delete failed:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to delete account" });
  }
});

export default router;
