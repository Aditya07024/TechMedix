import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  createStaffAccount,
  getStaffProfile,
  loginStaff,
  logStaffAction,
} from "../services/staffService.js";

const router = express.Router();

router.post(
  "/signup",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const staff = await createStaffAccount({
        ...req.body,
        created_by: req.user?.id || null,
      });

      await logStaffAction(
        staff.id,
        "staff_account_created",
        "staff",
        staff.id,
        { created_by: req.user?.id || null },
      );

      res.status(201).json({ success: true, user: staff });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

router.post("/login", async (req, res) => {
  try {
    const { token, user } = await loginStaff(req.body);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      ifLogin: true,
      token,
      role: "staff",
      user,
    });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

router.get(
  "/profile",
  authenticate,
  authorizeRoles("staff"),
  async (req, res) => {
    try {
      const profile = await getStaffProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ success: false, error: "Staff profile not found" });
      }

      res.json({ success: true, data: profile });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

export default router;
