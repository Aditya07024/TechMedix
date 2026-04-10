import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getPatientByEmail,
  createPatient,
  comparePassword,
} from "../models-pg/patient.js";
import sql from "../config/database.js";
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
      return res.status(400).json({ error: "Name, email and password are required" });
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
    { expiresIn: "1d" }
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
      role: user.role
    }
  });
}

    // 2️⃣ Otherwise fallback to patient table login
    const patient = await getPatientByEmail(email);
    if (!patient)
      return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await comparePassword(password, patient.password);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: patient.id, email: patient.email, role: "patient" },
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" }
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

export default router;
