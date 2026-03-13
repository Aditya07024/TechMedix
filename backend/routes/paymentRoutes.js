import express from "express";
import {
  createPayment,
  confirmOnlinePayment,
  markCashPayment,
  getDoctorEarningsSummary,
} from "../services/paymentService.js";
import { debitWallet, getWalletBalance } from "../services/walletService.js";
import sql from "../config/database.js";
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

// (moved export to end of file)

// Wallet: Pay with balance
router.post(
  "/pay-with-wallet",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { appointment_id } = req.body;
      if (!appointment_id) {
        return res.status(400).json({ error: "appointment_id is required" });
      }

      // fetch appointment + fee
      const appointment = await sql`
        SELECT a.id, a.patient_id, a.doctor_id, a.status, d.consultation_fee
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.id = ${appointment_id}
      `;

      if (!appointment.length) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (String(appointment[0].patient_id) !== String(req.user.id)) {
        return res.status(403).json({ error: "You can only pay for your appointment" });
      }

      if (["cancelled", "completed"].includes(appointment[0].status)) {
        return res.status(400).json({ error: "Appointment not eligible for payment" });
      }

      const amount = Number(appointment[0].consultation_fee) || 500;

      // Perform debit + create payment atomically
      // Debit wallet with a conditional update to prevent overdraft
      const debited = await sql`
        UPDATE wallets
        SET balance = balance - ${amount}, updated_at = NOW()
        WHERE patient_id = ${req.user.id}
          AND balance >= ${amount}
        RETURNING id, balance
      `;
      if (!debited.length) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      // Log wallet transaction
      await sql`
        INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, reference_id, note)
        VALUES (${debited[0].id}, ${req.user.id}, 'debit', ${amount}, 'payment', ${appointment_id}, 'Appointment payment via wallet')
      `;

      // Record payment and set appointment booked
      await sql`
        INSERT INTO payments (
          appointment_id, patient_id, doctor_id, amount, currency, payment_method, status, razorpay_payment_id
        ) VALUES (
          ${appointment_id}, ${req.user.id}, ${appointment[0].doctor_id}, ${amount}, 'INR', 'wallet', 'paid', 'WALLET'
        )
      `;
      await sql`
        UPDATE appointments
        SET status = 'booked'
        WHERE id = ${appointment_id}
      `;

      // Update analytics revenue for the appointment date
      try {
        const appt = await sql`
          SELECT a.appointment_date::date as date, a.doctor_id
          FROM appointments a
          WHERE a.id = ${appointment_id}
        `;
        if (appt.length) {
          await sql`
            INSERT INTO doctor_analytics (doctor_id, date, revenue_estimated)
            VALUES (${appointment[0].doctor_id}, ${appt[0].date}, ${amount})
            ON CONFLICT (doctor_id, date)
            DO UPDATE SET revenue_estimated = doctor_analytics.revenue_estimated + EXCLUDED.revenue_estimated,
                          updated_at = CURRENT_TIMESTAMP
          `;
        }
      } catch (e) {
        console.warn("Analytics revenue update (wallet) failed:", e.message);
      }

      res.json({ success: true, message: "Paid with wallet" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;

// Wallet: Balance
router.get(
  "/wallet/balance",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const balance = await getWalletBalance(req.user.id);
      res.json({ balance });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);
