import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  getPatientByEmail,
  createPatient,
  comparePassword,
} from "../models-pg/patient.js";
import { OAuth2Client } from "google-auth-library";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let ifLogin = false;

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
    const user = await getPatientByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: "patient" },
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed from "strict" to "lax"
      maxAge: 24 * 60 * 60 * 1000,
    });
    ifLogin = true;
    console.log("login successfull");
    // Return full patient record (excluding password) so frontend has complete profile.
    // NOTE: We are using PostgreSQL, so the fields come back as:
    // id, name, email, age, gender, phone, blood_group, medical_history, unique_code, created_at
    // Map them to the camelCase shape expected by the frontend.
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      phone: user.phone,
      address: user.address ?? null,
      bloodGroup: user.blood_group ?? null,
      medicalHistory: user.medical_history ?? null,
      uniqueCode: user.unique_code ?? null,
      createdAt: user.created_at ?? null,
    };

    res.json({
      ifLogin,
      user: safeUser,
      token,
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
    ifLogin = false;
    return res.json({
      ifLogin,
      message: "Logged out successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
router.get("/status", (req, res) => {
  res.json({ ifLogin });
});

export default router;
