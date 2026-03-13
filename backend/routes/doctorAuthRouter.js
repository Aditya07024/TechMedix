import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getDoctorByEmail,
  createDoctor,
  getDoctorById,
  updateDoctor,
} from "../models-pg/doctor.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * SIGNUP: Handles doctor registration
 */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, specialty } = req.body;

    if (!email || !password || !name || !specialty) {
      return res
        .status(400)
        .json({ error: "Name, email, password and specialty are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    const existing = await getDoctorByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Pass PLAIN password here.
    // The createDoctor function in your model handles the hashing.
    await createDoctor({
      name,
      email: cleanEmail,
      password: cleanPassword,
      specialty,
    });

    return res.status(201).json({ message: "Doctor registered successfully" });
  } catch (error) {
    console.error("[SIGNUP_ERROR]:", error); // Check your terminal to see specific DB errors
    return res
      .status(500)
      .json({ error: "Internal server error during registration" });
  }
});

/**
 * LOGIN: Handles authentication and JWT issuance
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // 1. Normalization
    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    // 2. Find Doctor
    const doctor = await getDoctorByEmail(cleanEmail);
    if (doctor?.is_deleted) {
      return res
        .status(403)
        .json({ error: "Account is deactivated. Contact admin." });
    }
    if (!doctor) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Compare Passwords
    // Log length for debugging (standard bcrypt hash is 60 chars)

    const isMatch = await bcrypt.compare(cleanPassword, doctor.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: doctor.id, role: "doctor" },
      process.env.TOKEN_SECRET,
      { expiresIn: "24h" },
    );

    // 5. Set Cookie & Send Response
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      ifLogin: true,
      role: "doctor",
      message: "Login successful",
      user: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: "doctor",
        consultation_fee: doctor.consultation_fee || 0,
        specialty: doctor.specialty,
      },
    });
  } catch (error) {
    console.error("[LOGIN_ERROR]:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during login" });
  }
});

// ---------- PROFILE ROUTES ----------
// GET current doctor profile
router.get(
  "/profile",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const doctor = await getDoctorById(req.user.id);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      res.json({ success: true, data: doctor });
    } catch (err) {
      console.error("Error fetching profile", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// PATCH update profile (fee or other fields)
router.patch(
  "/profile",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { consultation_fee, name, specialty } = req.body;
      const updated = await updateDoctor(req.user.id, {
        consultation_fee,
        name,
        specialty,
      });
      if (!updated) {
        return res.status(400).json({ error: "Update failed" });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Error updating profile", err);
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
