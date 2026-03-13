import express from "express";
import {
  createPayment,
  confirmOnlinePayment,
  markCashPayment,
  getDoctorEarningsSummary,
} from "../services/paymentService.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

// Create payment entry
router.post(
  "/create",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { appointment_id, payment_method } = req.body;

      if (!appointment_id || !payment_method) {
        console.warn("Missing payment fields:", {
          appointment_id,
          payment_method,
        });
        return res.status(400).json({
          error: "appointment_id and payment_method are required",
          received: { appointment_id, payment_method },
        });
      }

      // Validate appointment_id is a non-empty string (UUID format)
      if (typeof appointment_id !== "string" || appointment_id.trim() === "") {
        console.warn("Invalid appointment_id format:", appointment_id);
        return res.status(400).json({
          error: "appointment_id must be a valid string",
          received: appointment_id,
        });
      }

      const patient_id = req.user.id;

      if (!patient_id) {
        console.error("Patient ID not found in auth token");
        return res
          .status(400)
          .json({ error: "Patient ID not found in authentication" });
      }

      const payment = await createPayment(
        appointment_id,
        payment_method,
        patient_id,
      );

      res.json(payment);
    } catch (err) {
      let errorMessage = "Payment creation failed";

      // Extract error message from various error types
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      console.error("Payment creation error:", {
        message: errorMessage,
        errorType: typeof err,
        errorName: err?.name,
        errorCode: err?.code,
        fullError: JSON.stringify(err, null, 2),
      });

      res.status(400).json({ error: errorMessage });
    }
  },
);

// Confirm online payment
router.post(
  "/confirm",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          error:
            "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
        });
      }

      const result = await confirmOnlinePayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// Doctor marks cash payment
router.post(
  "/mark-cash-paid",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { payment_id } = req.body;

      if (!payment_id) {
        return res.status(400).json({ error: "payment_id is required" });
      }

      const result = await markCashPayment(payment_id);

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

router.get(
  "/doctor/:doctorId/summary",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({
          error: "You can only view your own earnings summary",
        });
      }

      const summary = await getDoctorEarningsSummary(doctorId);

      res.json(summary);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// alias route: some frontend code still posts to /verify
router.post(
  "/verify",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id, // provided by frontend but not used
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          error:
            "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
        });
      }

      const result = await confirmOnlinePayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

export default router;
