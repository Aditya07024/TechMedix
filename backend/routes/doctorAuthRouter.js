import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { getDoctorByEmail, createDoctor } from "../models-pg/doctor.js";

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * SIGNUP: Handles doctor registration
 */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, specialty } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
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
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

/**
 * LOGIN: Handles authentication and JWT issuance
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Normalization
    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    // 2. Find Doctor
    const doctor = await getDoctorByEmail(cleanEmail);
    if (!doctor) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Compare Passwords
    // Log length for debugging (standard bcrypt hash is 60 chars)
    console.log(`[AUTH] Comparing against hash of length: ${doctor.password.length}`);
    
    const isMatch = await bcrypt.compare(cleanPassword, doctor.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: doctor.id, role: "doctor" },
      process.env.TOKEN_SECRET,
      { expiresIn: "24h" }
    );

    // 5. Set Cookie & Send Response
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Login successful",
      user: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        role: "doctor"
      }
    });
  } catch (error) {
    console.error("[LOGIN_ERROR]:", error);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

export default router;