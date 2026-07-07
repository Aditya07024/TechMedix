import express from "express";
import axios from "axios";
import sql from "../config/database.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  listHospitalDoctors,
  linkDoctorToHospital,
  unlinkDoctorFromHospital,
  getHospitalSubscription,
  listPlans,
  activateHospitalSubscription,
  sendHospitalLinkRequest,
  respondToLinkRequest,
  getPendingLinkRequestsForDoctor,
  getHospitalLinkRequests,
  getHospitalDoctorsPerformance,
} from "../services/subscriptionService.js";


const router = express.Router();

// Enforce hospital role on all hospital routes
const verifyHospital = [authenticate, authorizeRoles("hospital")];

// ── Cashfree helpers ─────────────────────────────────────────────────────────
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = CASHFREE_SECRET_KEY?.includes("_prod_")
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
/**
 * POST Link a doctor by email (sends a pending request first)
 */
router.post("/link", verifyHospital, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Doctor email is required" });
    }
    const result = await sendHospitalLinkRequest(req.user.id, email);
    res.json({
      success: true,
      message: `Link request sent to Dr. ${result.doctor.name} successfully!`,
      data: result.request,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET list of link requests sent by hospital
 */
router.get("/link-requests", verifyHospital, async (req, res) => {
  try {
    const requests = await getHospitalLinkRequests(req.user.id);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET pending link requests for a doctor
 */
router.get("/doctor/link-requests", [authenticate, authorizeRoles("doctor")], async (req, res) => {
  try {
    const requests = await getPendingLinkRequestsForDoctor(req.user.id);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST respond to hospital link request
 */
router.post("/doctor/link-requests/:id/respond", [authenticate, authorizeRoles("doctor")], async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body; // 'accepted' or 'rejected'
    if (!response) {
      return res.status(400).json({ success: false, error: "response (accepted/rejected) is required" });
    }
    const result = await respondToLinkRequest(id, req.user.id, response);
    res.json({
      success: true,
      message: `Link request from hospital was successfully ${response}.`,
      data: result,
    });
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
    const hospitalPlans = allPlans.filter((p) => p.plan_type === "hospital");
    res.json({ success: true, data: hospitalPlans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /subscribe/initiate
 * Creates a Cashfree payment order for the selected hospital plan.
 * Does NOT activate the subscription yet — activation happens after payment verification.
 */
router.post("/subscribe/initiate", verifyHospital, async (req, res) => {
  try {
    const { plan_id, customer_phone } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, error: "plan_id is required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan_id)) {
      return res.status(400).json({ success: false, error: "Invalid plan ID format" });
    }

    // Fetch the plan to get price and details
    const planRows = await sql`
      SELECT * FROM subscription_plans WHERE id = ${plan_id} AND is_active = TRUE LIMIT 1
    `;
    if (!planRows.length) {
      return res.status(404).json({ success: false, error: "Plan not found or inactive" });
    }
    const plan = planRows[0];
    const amount = Number(plan.price);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Plan has no valid price" });
    }

    // Fetch hospital info for Cashfree customer details
    const hospitalRows = await sql`
      SELECT id, name, email, phone FROM hospitals WHERE id = ${req.user.id} AND is_deleted = FALSE LIMIT 1
    `;
    if (!hospitalRows.length) {
      return res.status(404).json({ success: false, error: "Hospital not found" });
    }
    const hospital = hospitalRows[0];

    const cleanPhone = (customer_phone || hospital.phone || "9999999999")
      .replace(/\D/g, "")
      .slice(-10) || "9999999999";

    // Build a unique Cashfree order ID
    const cfOrderId = `hosp_sub_${String(req.user.id).replace(/-/g, "").substring(0, 12)}_${Date.now()}`;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
    const returnUrl = `${cleanFrontendUrl}/hospital/dashboard?payment_trigger=cashfree&cf_order_id={order_id}&plan_id=${plan_id}`;

    // Create Cashfree order
    const cfRes = await axios.post(
      `${cashfreeBaseUrl}/orders`,
      {
        order_id: cfOrderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: String(req.user.id).substring(0, 36),
          customer_name: hospital.name || "Hospital",
          customer_email: hospital.email || "hospital@techmedix.com",
          customer_phone: cleanPhone,
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/v2/hospitals/subscribe/verify-webhook`,
        },
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
    console.error("[HOSPITAL_SUBSCRIBE_INITIATE_ERROR]:", err?.response?.data || err.message);
    res.status(500).json({ success: false, error: err?.response?.data?.message || err.message });
  }
});

/**
 * POST /subscribe/verify
 * Verifies the Cashfree payment and — only on success — activates the hospital subscription.
 */
router.post("/subscribe/verify", verifyHospital, async (req, res) => {
  try {
    const { cashfree_order_id, plan_id } = req.body;

    if (!cashfree_order_id || !plan_id) {
      return res.status(400).json({ success: false, error: "cashfree_order_id and plan_id are required" });
    }

    // Verify payment status with Cashfree
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
        error: "Payment not completed. Please complete the payment before activating the subscription.",
      });
    }

    const amountPaid = successPayment.payment_amount || 0;

    // Fetch plan duration
    const planRows = await sql`
      SELECT duration_days FROM subscription_plans WHERE id = ${plan_id} LIMIT 1
    `;
    const durationDays = planRows.length ? planRows[0].duration_days : 30;

    // Activate subscription
    const sub = await activateHospitalSubscription({
      hospitalId: req.user.id,
      planId: plan_id,
      durationDays,
      amountPaid,
      paymentNotes: `Paid via Cashfree. Order ID: ${cashfree_order_id}`,
    });

    res.json({
      success: true,
      message: "Payment verified and subscription activated successfully!",
      data: sub,
    });
  } catch (err) {
    console.error("[HOSPITAL_SUBSCRIBE_VERIFY_ERROR]:", err?.response?.data || err.message);
    res.status(500).json({ success: false, error: err?.response?.data?.message || err.message });
  }
});

/**
 * POST /subscribe (legacy — kept for admin/manual use)
 * Instantly activates a subscription without payment (admin-only action via admin dashboard).
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
      durationDays: 30,
      amountPaid: 0,
      paymentNotes: "Manually activated.",
    });

    res.json({ success: true, message: "Subscription activated successfully!", data: sub });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET hospital doctors performance (appointments, earnings, reviews)
 */
router.get("/performance", verifyHospital, async (req, res) => {
  try {
    const stats = await getHospitalDoctorsPerformance(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET hospital linked doctors' invoices/payments ledger (CA Tax / Invoices)
 */
router.get("/invoices", verifyHospital, async (req, res) => {
  try {
    const hospitalId = req.user.id;
    // 1. Get linked doctors
    const doctors = await sql`
      SELECT id, name FROM doctors
      WHERE hospital_id = ${hospitalId} AND is_deleted = FALSE
    `;
    if (doctors.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const doctorIds = doctors.map(d => d.id);
    
    // 2. Fetch payments for all linked doctors
    const payments = await sql`
      SELECT
        p.id,
        p.amount,
        p.gst_charges,
        p.platform_fees,
        p.total_amount,
        p.payment_method,
        p.status,
        p.created_at,
        p.appointment_id,
        pt.name AS patient_name,
        d.name AS doctor_name,
        d.reg_no AS doctor_reg_no,
        d.specialty AS doctor_specialty
      FROM payments p
      LEFT JOIN patients pt ON p.patient_id = pt.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      WHERE p.doctor_id IN (${doctorIds})
        AND p.status = 'paid'
        AND COALESCE(p.is_deleted, false) = false
      ORDER BY p.created_at DESC
    `;
    
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
