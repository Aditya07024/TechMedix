import express from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  createPlan,
  updatePlan,
  deletePlan,
  listPlans,
  getDoctorSubscription,
  checkSubscriptionValid,
  activateSubscription,
  getAllDoctorsWithSubscription,
} from "../services/subscriptionService.js";

const router = express.Router();

// ─── PUBLIC: List active plans ───
router.get("/plans", async (req, res) => {
  try {
    const plans = await listPlans(true);
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DOCTOR: Check own subscription status ───
router.get(
  "/doctor/:doctorId/status",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doctorId)) {
        return res.status(400).json({ success: false, error: "Invalid doctor ID format" });
      }

      // Doctors can only check their own, admins can check any
      if (req.user.role === "doctor" && String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      const status = await checkSubscriptionValid(doctorId);
      res.json({ success: true, data: status });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── DOCTOR: Get own subscription details ───
router.get(
  "/doctor/:doctorId",
  authenticate,
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doctorId)) {
        return res.status(400).json({ success: false, error: "Invalid doctor ID format" });
      }

      if (req.user.role === "doctor" && String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }

      const subscription = await getDoctorSubscription(doctorId);
      res.json({ success: true, data: subscription });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Create plan ───
router.post(
  "/plans",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, price, trial_duration_days, duration_days, features, plan_type, max_doctors } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: "Plan name is required" });
      }
      const plan = await createPlan({ name, price, trial_duration_days, duration_days, features, plan_type, max_doctors });
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Update plan ───
router.put(
  "/plans/:planId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const plan = await updatePlan(req.params.planId, req.body);
      res.json({ success: true, data: plan });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Delete plan ───
router.delete(
  "/plans/:planId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      await deletePlan(req.params.planId);
      res.json({ success: true, message: "Plan deleted" });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: List all plans (including inactive) ───
router.get(
  "/admin/plans",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const plans = await listPlans(false);
      res.json({ success: true, data: plans });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Activate subscription for doctor ───
router.post(
  "/activate",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { doctor_id, plan_id, duration_days, amount_paid, payment_notes } = req.body;
      if (!doctor_id) {
        return res.status(400).json({ success: false, error: "doctor_id is required" });
      }
      const subscription = await activateSubscription({
        doctorId: doctor_id,
        planId: plan_id,
        durationDays: duration_days,
        amountPaid: amount_paid,
        paymentNotes: payment_notes,
        activatedBy: req.user.id,
      });
      res.json({ success: true, data: subscription });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Get all doctors with subscription status ───
router.get(
  "/admin/doctors",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const doctors = await getAllDoctorsWithSubscription();
      res.json({ success: true, data: doctors });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Get all hospitals with subscription status ───
router.get(
  "/admin/hospitals",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      // Import the dynamically added service function
      const { getAllHospitalsWithSubscription } = await import("../services/subscriptionService.js");
      const hospitals = await getAllHospitalsWithSubscription();
      res.json({ success: true, data: hospitals });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ─── ADMIN: Activate subscription for hospital ───
router.post(
  "/admin/hospitals/activate",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { hospital_id, plan_id, duration_days, amount_paid, payment_notes } = req.body;
      if (!hospital_id) {
        return res.status(400).json({ success: false, error: "hospital_id is required" });
      }
      const { activateHospitalSubscription } = await import("../services/subscriptionService.js");
      const subscription = await activateHospitalSubscription({
        hospitalId: hospital_id,
        planId: plan_id,
        durationDays: duration_days,
        amountPaid: amount_paid,
        paymentNotes: payment_notes,
      });
      res.json({ success: true, data: subscription });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
