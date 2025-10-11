import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Doctor from "../models/doctor.js"; // Import the Doctor model
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Doctor Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, specialty } = req.body;
    let doctor = await Doctor.findOne({ email });
    if (doctor) {
      return res.status(400).json({ error: "Doctor already exists" });
    }

    doctor = new Doctor({
      name,
      email,
      password,
      specialty,
    });
    await doctor.save();

    res.json({ message: "Doctor registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Doctor signup failed" });
  }
});

// Doctor Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const doctor = await Doctor.findOne({ email });
    if (!doctor) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: doctor._id, email: doctor.email, role: "doctor" }, // Add role to token
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed from "strict" to "lax"
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty,
        role: "doctor",
      },
      token,
      message: "Doctor logged in successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Doctor login failed" });
  }
});

// Doctor Logout (similar to patient logout)
router.get("/logout", async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    return res.json({
      message: "Doctor logged out successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
