import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Patient from "../models/patient.js"; // Changed from User to Patient
import { OAuth2Client } from "google-auth-library";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let ifLogin = false;

// Google OAuth login
router.post("/google", async (req, res) => {
  app.use(
    cors({
      origin: process.env.FRONTEND_URL, // frontend URL
      credentials: true, // allow cookies
    })
  );
  try {
    const { code } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: code,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture } = ticket.getPayload();

    // Placeholder for checking if user exists in database
    // const user = await User.findOne({ email });
    // if (!user) {
    //   // Create new user
    //   await User.create({ email, name, picture });
    // }

    const token = jwt.sign({ email, name }, process.env.TOKEN_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      user: { email, name, picture },
      token,
      message: "Successfully authenticated with Google",
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    setError(err.response?.data?.error || "Authentication failed");
    res.status(401).json({ error });
  }
});

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
    let user = await Patient.findOne({ email }); // Changed from User to Patient
    if (user) {
      console.log("user already exists");
      return res.status(400).json({ error: "User already exists" });
    }

    user = new Patient({
      name,
      email,
      password,
      age,
      gender,
      phone,
      address,
      bloodGroup,
      medicalHistory,
      code: process.env.company_code,
    }); // Changed from User to Patient and added new fields
    console.log(user);
    await user.save();

    res.json({ message: "Patient registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password, code } = req.body;
    const user = await Patient.findOne({ email }); // Changed from User to Patient
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    if (code !== process.env.company_code) {
      return res.status(401).json({ error: "Invalid code" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });
    ifLogin = true;
    console.log("login successfull");
    // Return full patient record (excluding password) so frontend has complete profile
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      phone: user.phone,
      address: user.address,
      bloodGroup: user.bloodGroup,
      medicalHistory: user.medicalHistory,
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
