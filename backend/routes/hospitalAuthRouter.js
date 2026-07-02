import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import sql from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * Hospital SIGNUP
 */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    // Check if email already registered in hospitals table
    const existing = await sql`
      SELECT id FROM hospitals WHERE email = ${cleanEmail} AND is_deleted = FALSE LIMIT 1
    `;
    if (existing.length) {
      return res.status(409).json({ error: "Email already registered to a hospital." });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(cleanPassword, SALT_ROUNDS);

    const result = await sql`
      INSERT INTO hospitals (name, email, password_hash, phone, address)
      VALUES (${name}, ${cleanEmail}, ${passwordHash}, ${phone || null}, ${address || null})
      RETURNING id, name, email, phone, address, created_at
    `;

    return res.status(201).json({ success: true, message: "Hospital registered successfully", data: result[0] });
  } catch (error) {
    console.error("[HOSPITAL_SIGNUP_ERROR]:", error);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

/**
 * Hospital LOGIN
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.trim();

    // Find hospital
    const hospitalRes = await sql`
      SELECT * FROM hospitals WHERE email = ${cleanEmail} AND is_deleted = FALSE LIMIT 1
    `;

    if (!hospitalRes.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const hospital = hospitalRes[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(cleanPassword, hospital.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: hospital.id, hospital_id: hospital.id, role: "hospital" },
      process.env.TOKEN_SECRET,
      { expiresIn: "24h" }
    );

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      ifLogin: true,
      role: "hospital",
      token,
      message: "Login successful",
      user: {
        id: hospital.id,
        name: hospital.name,
        email: hospital.email,
        role: "hospital",
        phone: hospital.phone || "",
        address: hospital.address || "",
      },
    });
  } catch (error) {
    console.error("[HOSPITAL_LOGIN_ERROR]:", error);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

/**
 * GET Profile
 */
router.get("/profile", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const hospitalRes = await sql`
      SELECT id, name, email, phone, address, created_at
      FROM hospitals
      WHERE id = ${req.user.id} AND is_deleted = FALSE
      LIMIT 1
    `;

    if (!hospitalRes.length) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    return res.json({ success: true, data: hospitalRes[0] });
  } catch (error) {
    console.error("[HOSPITAL_PROFILE_GET_ERROR]:", error);
    return res.status(500).json({ error: "Internal server error fetching profile" });
  }
});

/**
 * PATCH Profile
 */
router.patch("/profile", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const { name, phone, address } = req.body;

    const result = await sql`
      UPDATE hospitals
      SET
        name = COALESCE(${name || null}, name),
        phone = COALESCE(${phone || null}, phone),
        address = COALESCE(${address || null}, address),
        updated_at = NOW()
      WHERE id = ${req.user.id} AND is_deleted = FALSE
      RETURNING id, name, email, phone, address, created_at
    `;

    if (!result.length) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    return res.json({ success: true, message: "Profile updated successfully", data: result[0] });
  } catch (error) {
    console.error("[HOSPITAL_PROFILE_PATCH_ERROR]:", error);
    return res.status(500).json({ error: "Internal server error updating profile" });
  }
});

export default router;
