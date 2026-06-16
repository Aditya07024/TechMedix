import express from "express";
import {
  createPayment,
  confirmOnlinePayment,
  markCashPayment,
  getDoctorEarningsSummary,
  getDoctorRevenueDetails,
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
      const { appointment_id, payment_method, booking_details } = req.body;

      if ((!appointment_id && !booking_details) || !payment_method) {
        console.warn("Missing payment fields:", {
          appointment_id,
          booking_details,
          payment_method,
        });
        return res.status(400).json({
          error: "appointment_id or booking_details, and payment_method are required",
          received: { appointment_id, booking_details, payment_method },
        });
      }

      if (
        appointment_id &&
        (typeof appointment_id !== "string" || appointment_id.trim() === "")
      ) {
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

      const payment = await createPayment({
        appointmentId: appointment_id || null,
        paymentMethod: payment_method,
        patientIdFromAuth: patient_id,
        bookingDetails: booking_details || null,
      });

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
      const orderId = req.body.order_id || req.body.razorpay_order_id;
      const paymentId = req.body.payment_id || req.body.razorpay_payment_id;

      if (!orderId) {
        return res.status(400).json({
          error: "order_id is required",
        });
      }

      const result = await confirmOnlinePayment(orderId, paymentId);

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
  authorizeRoles("doctor", "staff"),
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

router.get(
  "/doctor/:doctorId/details",
  authenticate,
  authorizeRoles("doctor"),
  async (req, res) => {
    try {
      const { doctorId } = req.params;

      if (String(req.user.id) !== String(doctorId)) {
        return res.status(403).json({
          error: "You can only view your own revenue details",
        });
      }

      const details = await getDoctorRevenueDetails(doctorId);
      res.json(details);
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
      const orderId = req.body.order_id || req.body.razorpay_order_id;
      const paymentId = req.body.payment_id || req.body.razorpay_payment_id;

      if (!orderId) {
        return res.status(400).json({
          error: "order_id is required",
        });
      }

      const result = await confirmOnlinePayment(orderId, paymentId);

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
      const { appointment_id, booking_details } = req.body;
      if (!appointment_id && !booking_details) {
        return res.status(400).json({ error: "appointment_id or booking_details is required" });
      }

      const payment = await createPayment({
        appointmentId: appointment_id || null,
        paymentMethod: "wallet",
        patientIdFromAuth: req.user.id,
        bookingDetails: booking_details || null,
      });

      const amount = Number(payment?.amount || 0);
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

      await sql`
        INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, reference_id, note)
        VALUES (${debited[0].id}, ${req.user.id}, 'debit', ${amount}, 'payment', ${payment.appointment_id || payment.id}, 'Appointment payment via wallet')
      `;

      await sql`
        UPDATE payments
        SET status = 'paid',
            razorpay_payment_id = 'WALLET',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${payment.id}
      `;

      try {
        const appt = await sql`
          SELECT a.appointment_date::date as date, a.doctor_id
          FROM appointments a
          WHERE a.id = ${payment.appointment_id}
        `;
        if (appt.length) {
          await sql`
            INSERT INTO doctor_analytics (doctor_id, date, revenue_estimated)
            VALUES (${appt[0].doctor_id}, ${appt[0].date}, ${amount})
            ON CONFLICT (doctor_id, date)
            DO UPDATE SET revenue_estimated = doctor_analytics.revenue_estimated + EXCLUDED.revenue_estimated,
                          updated_at = CURRENT_TIMESTAMP
          `;
        }
      } catch (e) {
        console.warn("Analytics revenue update (wallet) failed:", e.message);
      }

      res.json({ success: true, message: "Paid with wallet", payment_id: payment.id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

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

// Wallet: Transactions
router.get(
  "/wallet/transactions",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const txs = await sql`
        SELECT *
        FROM wallet_transactions
        WHERE patient_id = ${req.user.id}
        ORDER BY created_at DESC
      `;
      res.json({ success: true, data: txs });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Wallet: Request Transfer / Withdraw to Bank
router.post(
  "/wallet/withdraw",
  authenticate,
  authorizeRoles("patient"),
  async (req, res) => {
    try {
      const { amount, upi_id } = req.body;
      const withdrawAmount = Number(amount);

      if (!withdrawAmount || withdrawAmount <= 0) {
        return res.status(400).json({ error: "Invalid withdrawal amount" });
      }

      if (!upi_id || typeof upi_id !== "string" || !upi_id.includes("@")) {
        return res.status(400).json({ error: "Invalid UPI ID format" });
      }

      // Check balance and deduct in a single atomic transaction/operation
      const debited = await sql`
        UPDATE wallets
        SET balance = balance - ${withdrawAmount}, updated_at = NOW()
        WHERE patient_id = ${req.user.id}
          AND balance >= ${withdrawAmount}
        RETURNING id, balance
      `;

      if (!debited.length) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      // Insert transaction
      const tx = await sql`
        INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, note)
        VALUES (${debited[0].id}, ${req.user.id}, 'debit', ${withdrawAmount}, 'withdrawal', 'Pending transfer to account (UPI: ' || ${upi_id} || ')')
        RETURNING id
      `;

      // Create a support ticket for the admin to process
      const ticket = await sql`
        INSERT INTO support_tickets (patient_id, subject, category, description, status)
        VALUES (
          ${req.user.id},
          'Wallet Withdrawal Request - ₹' || ${withdrawAmount},
          'withdrawal',
          'Patient requested to transfer ₹' || ${withdrawAmount} || ' to account. UPI ID: ' || ${upi_id} || '. Transaction ID: ' || ${tx[0].id},
          'open'
        )
        RETURNING *
      `;

      res.json({
        success: true,
        message: "Withdrawal request submitted successfully",
        balance: debited[0].balance,
        ticket: ticket[0]
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
