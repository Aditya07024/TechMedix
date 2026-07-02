import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  listHospitalDoctors,
  linkDoctorToHospital,
  unlinkDoctorFromHospital,
  getHospitalSubscription,
  listPlans,
  activateHospitalSubscription,
} from "../services/subscriptionService.js";

const router = express.Router();

// Enforce hospital role on all hospital routes
const verifyHospital = [authenticate, authorizeRoles("hospital")];

/**
 * GET current hospital subscription status
 */
router.get("/subscription", verifyHospital, async (req, res) => {
  try {
    const sub = await getHospitalSubscription(req.user.id);
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET list of linked doctors
 */
router.get("/doctors", verifyHospital, async (req, res) => {
  try {
    const doctors = await listHospitalDoctors(req.user.id);
    res.json({ success: true, data: doctors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST Link a doctor by email
 */
router.post("/link", verifyHospital, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Doctor email is required" });
    }
    const doctor = await linkDoctorToHospital(req.user.id, email);
    res.json({ success: true, message: `Dr. ${doctor.name} linked successfully!`, data: doctor });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST Unlink a doctor by ID
 */
router.post("/unlink", verifyHospital, async (req, res) => {
  try {
    const { doctor_id } = req.body;
    if (!doctor_id) {
      return res.status(400).json({ success: false, error: "doctor_id is required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doctor_id)) {
      return res.status(400).json({ success: false, error: "Invalid doctor ID format" });
    }
    const result = await unlinkDoctorFromHospital(req.user.id, doctor_id);
    res.json({ success: true, message: `Doctor unlinked successfully.`, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET list of hospital subscription plans
 */
router.get("/plans", verifyHospital, async (req, res) => {
  try {
    const allPlans = await listPlans(true);
    // Filter plans where type is 'hospital'
    const hospitalPlans = allPlans.filter(p => p.plan_type === "hospital");
    res.json({ success: true, data: hospitalPlans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST purchase/select a hospital subscription plan (simulated purchase)
 */
router.post("/subscribe", verifyHospital, async (req, res) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ success: false, error: "plan_id is required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan_id)) {
      return res.status(400).json({ success: false, error: "Invalid plan ID format" });
    }

    const sub = await activateHospitalSubscription({
      hospitalId: req.user.id,
      planId: plan_id,
      durationDays: 30, // 30 days default
      amountPaid: 0, // Simulated free trial or instant payment
      paymentNotes: "Instantly simulated from hospital dashboard.",
    });

    res.json({ success: true, message: "Subscription activated successfully!", data: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
