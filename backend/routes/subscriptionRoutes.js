import express from "express";
import axios from "axios";
import sql from "../config/database.js";
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

// ── Cashfree helpers ─────────────────────────────────────────────────────────
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV =
  CASHFREE_SECRET_KEY?.includes("_prod_")
    ? "production"
    : CASHFREE_SECRET_KEY?.includes("_test_")
    ? "sandbox"
    : process.env.CASHFREE_ENV || "sandbox";

const cashfreeBaseUrl =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const cashfreeHeaders = () => ({
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET_KEY,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json",
});

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

/**
 * POST /doctor/subscribe/initiate
 * Creates a Cashfree payment order for a doctor's chosen plan.
 * Does NOT activate the subscription yet.
 */
router.post(
  "/doctor/subscribe/initiate",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { plan_id, customer_phone } = req.body;

      if (!plan_id) {
        return res.status(400).json({ success: false, error: "plan_id is required" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan_id)) {
        return res.status(400).json({ success: false, error: "Invalid plan ID format" });
      }

      // Fetch plan — only individual/doctor type plans
      const planRows = await sql`
        SELECT * FROM subscription_plans
        WHERE id = ${plan_id}
          AND is_active = TRUE
          AND (plan_type = 'individual' OR plan_type = 'doctor' OR plan_type IS NULL)
        LIMIT 1
      `;
      if (!planRows.length) {
        return res.status(404).json({ success: false, error: "Plan not found or not available for doctors" });
      }
      const plan = planRows[0];
      const amount = Number(plan.price);

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Plan has no valid price" });
      }

      // Fetch doctor info
      const doctorRows = await sql`
        SELECT id, name, email, phone FROM doctors WHERE id = ${req.user.id} LIMIT 1
      `;
      if (!doctorRows.length) {
        return res.status(404).json({ success: false, error: "Doctor not found" });
      }
      const doctor = doctorRows[0];

      const cleanPhone =
        (customer_phone || doctor.phone || "9999999999")
          .replace(/\D/g, "")
          .slice(-10) || "9999999999";

      const cfOrderId = `doc_sub_${String(req.user.id).replace(/-/g, "").substring(0, 12)}_${Date.now()}`;

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
      const returnUrl = `${cleanFrontendUrl}/doctor/dashboard?payment_trigger=cashfree&cf_order_id={order_id}&plan_id=${plan_id}`;

      const cfRes = await axios.post(
        `${cashfreeBaseUrl}/orders`,
        {
          order_id: cfOrderId,
          order_amount: amount,
          order_currency: "INR",
          customer_details: {
            customer_id: String(req.user.id).substring(0, 36),
            customer_name: doctor.name || "Doctor",
            customer_email: doctor.email || "doctor@techmedix.com",
            customer_phone: cleanPhone,
          },
          order_meta: { return_url: returnUrl },
        },
        { headers: cashfreeHeaders() }
      );

      const cfOrder = cfRes.data;

      res.json({
        success: true,
        payment_session_id: cfOrder.payment_session_id,
        cashfree_order_id: cfOrder.order_id,
        amount,
        plan_name: plan.name,
        plan_duration_days: plan.duration_days,
        cashfree_mode: CASHFREE_ENV,
      });
    } catch (err) {
      console.error("[DOCTOR_SUBSCRIBE_INITIATE_ERROR]:", err?.response?.data || err.message);
      res.status(500).json({ success: false, error: err?.response?.data?.message || err.message });
    }
  }
);

/**
 * POST /doctor/subscribe/verify
 * Verifies Cashfree payment and activates the doctor's subscription.
 */
router.post(
  "/doctor/subscribe/verify",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { cashfree_order_id, plan_id } = req.body;

      if (!cashfree_order_id || !plan_id) {
        return res.status(400).json({
          success: false,
          error: "cashfree_order_id and plan_id are required",
        });
      }

      const verifyRes = await axios.get(
        `${cashfreeBaseUrl}/orders/${cashfree_order_id}/payments`,
        { headers: cashfreeHeaders() }
      );

      const payments = verifyRes.data;
      const successPayment = Array.isArray(payments)
        ? payments.find((p) => p.payment_status === "SUCCESS")
        : null;

      if (!successPayment) {
        return res.status(402).json({
          success: false,
          error: "Payment not completed. Please finish the payment before activating.",
        });
      }

      const amountPaid = successPayment.payment_amount || 0;

      const planRows = await sql`
        SELECT duration_days FROM subscription_plans WHERE id = ${plan_id} LIMIT 1
      `;
      const durationDays = planRows.length ? planRows[0].duration_days : 30;

      const subscription = await activateSubscription({
        doctorId: req.user.id,
        planId: plan_id,
        durationDays,
        amountPaid,
        paymentNotes: `Paid via Cashfree. Order ID: ${cashfree_order_id}`,
        activatedBy: "self",
      });

      res.json({
        success: true,
        message: "Payment verified and subscription activated!",
        data: subscription,
      });
    } catch (err) {
      console.error("[DOCTOR_SUBSCRIBE_VERIFY_ERROR]:", err?.response?.data || err.message);
      res.status(500).json({ success: false, error: err?.response?.data?.message || err.message });
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
