import sql from "../config/database.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
  bookAppointment,
  validateAppointmentBookingData,
} from "./appointmentService.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Payment Entry
export async function createPayment({
  appointmentId = null,
  paymentMethod,
  patientIdFromAuth,
  bookingDetails = null,
}) {
  let resolvedAppointmentId = appointmentId;

  try {
    if (!paymentMethod) {
      throw new Error("Payment method is required");
    }

    const normalizedBookingDetails = bookingDetails
      ? {
          patient_id: patientIdFromAuth,
          doctor_id: bookingDetails.doctor_id,
          appointment_date: bookingDetails.appointment_date,
          slot_time: bookingDetails.slot_time,
          share_history: Boolean(bookingDetails.share_history),
          share_history_scope: Array.isArray(bookingDetails.share_history_scope)
            ? bookingDetails.share_history_scope
            : [],
          recording_consent_patient: Boolean(
            bookingDetails.recording_consent_patient,
          ),
        }
      : null;

    console.log("Creating payment for:", {
      appointmentId,
      paymentMethod,
      patientIdFromAuth,
      hasBookingDetails: Boolean(normalizedBookingDetails),
    });

    let appointment = [];
    let patient_id = patientIdFromAuth;
    let doctor_id = null;
    let amount = 0;
    let bookingPayload = normalizedBookingDetails;

    if (resolvedAppointmentId) {
      if (typeof resolvedAppointmentId !== "string" || resolvedAppointmentId.trim() === "") {
        throw new Error("Invalid appointment ID");
      }

      appointment = await sql`
        SELECT * FROM appointments
        WHERE id = ${resolvedAppointmentId}
      `;

      if (appointment.length === 0) {
        throw new Error("Appointment not found");
      }

      if (patientIdFromAuth && appointment[0].patient_id !== patientIdFromAuth) {
        console.warn("Authorization check failed:", {
          appointmentPatientId: appointment[0].patient_id,
          authPatientId: patientIdFromAuth,
        });
        throw new Error("You can only pay for your own appointments");
      }

      if (["cancelled", "completed"].includes(appointment[0].status)) {
        console.log("Appointment status:", appointment[0].status);
        throw new Error("Appointment not eligible for payment");
      }

      patient_id = patientIdFromAuth || appointment[0].patient_id;
      doctor_id = appointment[0].doctor_id;
    } else if (normalizedBookingDetails) {
      if (
        !normalizedBookingDetails.doctor_id ||
        !normalizedBookingDetails.appointment_date ||
        !normalizedBookingDetails.slot_time
      ) {
        throw new Error("Booking details are incomplete");
      }

      const preparedBooking = await validateAppointmentBookingData(
        normalizedBookingDetails,
      );
      doctor_id = normalizedBookingDetails.doctor_id;
      amount = preparedBooking.consultation_fee;
      bookingPayload = {
        ...normalizedBookingDetails,
        consultation_fee: preparedBooking.consultation_fee,
        doctor_name: preparedBooking.doctor_name,
      };
    } else {
      throw new Error("Appointment or booking details are required");
    }

    const existingPayment = await sql`
      SELECT * FROM payments
      WHERE (
        (${resolvedAppointmentId}::uuid IS NOT NULL AND appointment_id = ${resolvedAppointmentId})
        OR (
          ${resolvedAppointmentId}::uuid IS NULL
          AND patient_id = ${patient_id}
          AND doctor_id = ${doctor_id}
          AND COALESCE(booking_payload->>'appointment_date', '') = ${bookingPayload?.appointment_date || ""}
          AND COALESCE(booking_payload->>'slot_time', '') = ${bookingPayload?.slot_time || ""}
        )
      )
        AND status IN ('pending','paid')
    `;

    // If a pending payment already exists, recreate a Razorpay order for it
    if (existingPayment.length > 0 && existingPayment[0].status === "pending") {
      let razorpayOrder = null;

      if (paymentMethod === "online") {
        const fee = amount || Number(existingPayment[0]?.amount) || 500;
        const razorAmount = Math.round(fee * 100);
        const receiptSource =
          resolvedAppointmentId ||
          `${doctor_id || "doc"}${bookingPayload?.appointment_date || ""}${bookingPayload?.slot_time || ""}`;

        const shortReceipt = `rcpt_${String(receiptSource).replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}_${Date.now().toString().slice(-8)}`;
        const order = await razorpay.orders.create({
          amount: razorAmount,
          currency: "INR",
          receipt: shortReceipt,
        });

        console.log("Razorpay order recreated for existing payment", {
          orderId: order.id,
          amount: order.amount,
        });

        await sql`
          UPDATE payments
          SET razorpay_order_id = ${order.id}
          WHERE id = ${existingPayment[0].id}
        `;

        razorpayOrder = order;
      }

      return {
        success: true,
        orderId: razorpayOrder?.id,
        amount: razorpayOrder?.amount,
        currency: razorpayOrder?.currency,
        ...existingPayment[0],
        order: razorpayOrder,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    }

    // If already paid, block duplicate payment
    if (existingPayment.length > 0 && existingPayment[0].status === "paid") {
      throw new Error("Payment already completed for this appointment");
    }

    if (!amount) {
      const doctor = await sql`
        SELECT consultation_fee FROM doctors
        WHERE id = ${doctor_id}
      `;

      if (!doctor.length) {
        console.error("Doctor not found for payment", {
          doctor_id,
          appointmentId: resolvedAppointmentId,
        });
        throw new Error("Doctor not found for this appointment");
      }

      amount = Number(doctor[0].consultation_fee) || 500;
    }

    let razorpayOrderId = null;
    let razorpayOrder = null;

    if (
      !resolvedAppointmentId &&
      bookingPayload &&
      ["cash", "wallet"].includes(paymentMethod)
    ) {
      const bookedAppointment = await bookAppointment({
        ...bookingPayload,
        patient_id,
      });
      resolvedAppointmentId = bookedAppointment.id;
    }

    if (paymentMethod === "online") {
      const razorAmount = Math.round(amount * 100);
      const receiptSource =
        resolvedAppointmentId ||
        `${doctor_id || "doc"}${bookingPayload?.appointment_date || ""}${bookingPayload?.slot_time || ""}`;

      const shortReceipt = `rcpt_${String(receiptSource).replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)}_${Date.now().toString().slice(-8)}`;
      const order = await razorpay.orders.create({
        amount: razorAmount,
        currency: "INR",
        receipt: shortReceipt,
      });

      console.log("Razorpay order created", {
        orderId: order.id,
        amount: order.amount,
      });

      razorpayOrderId = order.id;
      razorpayOrder = order;
    }

    if (!patient_id || !doctor_id) {
      console.error("Invalid payment identifiers", {
        patient_id,
        doctor_id,
        appointmentId: resolvedAppointmentId,
      });
      throw new Error("Invalid payment identifiers");
    }

    const payment = await sql`
      INSERT INTO payments (
  appointment_id,
  patient_id,
  doctor_id,
  amount,
  currency,
  payment_method,
  status,
  razorpay_order_id,
  booking_payload
)
VALUES (
  ${resolvedAppointmentId},
  ${patient_id},
  ${doctor_id},
  ${amount},
  'INR',
  ${paymentMethod},
  ${paymentMethod === 'cash' ? 'due' : 'pending'},
  ${razorpayOrderId},
  ${bookingPayload ? sql.json(bookingPayload) : null}
)
      RETURNING *
    `;

    // return extra fields required by frontend and debugging
    return {
      success: true,
      orderId: razorpayOrderId,
      amount: razorpayOrder?.amount,
      currency: razorpayOrder?.currency,
      ...payment[0],
      order: razorpayOrder,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    // Extract meaningful error message from various error types
    let errorMessage = "Payment creation failed";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error?.sql) {
      // Postgres error
      errorMessage = error.detail || error.hint || "Database error occurred";
    }

    console.error("Payment service error:", {
      message: errorMessage,
      appointmentId: resolvedAppointmentId,
      paymentMethod,
      fullError: JSON.stringify(error, null, 2),
    });
    throw new Error(errorMessage);
  }
}

export async function confirmOnlinePayment(
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
) {
  const body = razorpayOrderId + "|" + razorpayPaymentId;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  // logging to troubleshoot mismatches
  console.log("Verifying payment", {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedSignature,
  });

  if (expectedSignature !== razorpaySignature) {
    console.error("Signature mismatch", {
      expectedSignature,
      razorpaySignature,
    });
    throw new Error("Invalid Razorpay signature");
  }

  console.log("Signature verification passed, looking up payment record...");

  const payment = await sql`
    SELECT * FROM payments
    WHERE razorpay_order_id = ${razorpayOrderId}
  `;

  console.log("Payment lookup result:", {
    found: payment.length > 0,
    paymentId: payment[0]?.id,
  });

  if (!payment.length) {
    throw new Error("Payment record not found");
  }

  if (payment[0].status === "paid") {
    console.log("Payment already confirmed");
    return { message: "Payment already confirmed" };
  }

  console.log("Updating payment status to paid...");

  try {
    await sql.begin(async (tx) => {
      let appointmentId = payment[0].appointment_id;

      if (!appointmentId && payment[0].booking_payload) {
        const bookedAppointment = await bookAppointment({
          ...payment[0].booking_payload,
          patient_id: payment[0].patient_id,
        });
        appointmentId = bookedAppointment.id;
      }

      await tx`
        UPDATE payments
        SET status = 'paid',
            razorpay_payment_id = ${razorpayPaymentId},
            razorpay_signature = ${razorpaySignature},
            appointment_id = COALESCE(${appointmentId}, appointment_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = ${razorpayOrderId}
      `;

      if (appointmentId) {
        await tx`
          UPDATE appointments
          SET status = 'booked'
          WHERE id = ${appointmentId}
        `;
      }
    });
    console.log("Payment status updated successfully");
  } catch (updateError) {
    console.error("Failed to update payment status:", updateError);
    throw new Error(`Payment update failed: ${updateError.message}`);
  }

  console.log("Payment confirmation completed successfully");

  // Update doctor analytics revenue for the appointment date
  try {
    const paidPayment = await sql`
      SELECT appointment_id
      FROM payments
      WHERE razorpay_order_id = ${razorpayOrderId}
      LIMIT 1
    `;
    const confirmedAppointmentId =
      paidPayment[0]?.appointment_id || payment[0].appointment_id;
    const appt = await sql`
      SELECT a.appointment_date::date as date, a.doctor_id, d.consultation_fee
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = ${confirmedAppointmentId}
    `;
    if (appt.length) {
      const fee = Number(appt[0].consultation_fee) || 0;
      await sql`
        INSERT INTO doctor_analytics (doctor_id, date, revenue_estimated)
        VALUES (${appt[0].doctor_id}, ${appt[0].date}, ${fee})
        ON CONFLICT (doctor_id, date)
        DO UPDATE SET revenue_estimated = doctor_analytics.revenue_estimated + EXCLUDED.revenue_estimated,
                      updated_at = CURRENT_TIMESTAMP
      `;
    }
  } catch (e) {
    console.warn("Analytics revenue update failed:", e.message);
  }

  return {
    message: "Payment successful",
    transaction_id: razorpayPaymentId,
  };
}

// Mark Cash Payment
export async function markCashPayment(paymentId) {
  const payment = await sql`
    SELECT * FROM payments
    WHERE id = ${paymentId}
  `;

  if (payment.length === 0) {
    throw new Error("Payment not found");
  }

  if (payment[0].status === "paid") {
    return { message: "Payment already marked as paid" };
  }

  if (payment[0].payment_method !== "cash") {
    throw new Error("This payment is not a cash payment");
  }

  if (payment[0].status !== "due") {
    throw new Error("Payment is not in due status");
  }

  await sql`
    UPDATE payments
    SET status = 'paid',
        razorpay_payment_id = 'CASH'
    WHERE id = ${paymentId}
  `;

  // Update analytics revenue for the appointment date
  try {
    const appt = await sql`
      SELECT a.appointment_date::date as date, a.doctor_id, d.consultation_fee
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = ${payment[0].appointment_id}
    `;
    if (appt.length) {
      const fee = Number(appt[0].consultation_fee) || 0;
      await sql`
        INSERT INTO doctor_analytics (doctor_id, date, revenue_estimated)
        VALUES (${appt[0].doctor_id}, ${appt[0].date}, ${fee})
        ON CONFLICT (doctor_id, date)
        DO UPDATE SET revenue_estimated = doctor_analytics.revenue_estimated + EXCLUDED.revenue_estimated,
                      updated_at = CURRENT_TIMESTAMP
      `;
    }
  } catch (e) {
    console.warn("Analytics revenue update (cash) failed:", e.message);
  }

  return { message: "Cash payment marked as paid" };
}
export async function getDoctorEarningsSummary(doctorId) {
  const total = await sql`
    SELECT COALESCE(SUM(amount),0) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
    AND status = 'paid'
    AND COALESCE(is_deleted, false) = false
  `;

  const today = await sql`
    SELECT COALESCE(SUM(amount),0) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
    AND status = 'paid'
    AND created_at::date = CURRENT_DATE
    AND COALESCE(is_deleted, false) = false
  `;

  const online = await sql`
    SELECT COALESCE(SUM(amount),0) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
    AND status = 'paid'
    AND payment_method = 'online'
    AND COALESCE(is_deleted, false) = false
  `;

  const cash = await sql`
    SELECT COALESCE(SUM(amount),0) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
    AND status = 'paid'
    AND payment_method = 'cash'
    AND COALESCE(is_deleted, false) = false
  `;

  const count = await sql`
    SELECT COUNT(*) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
    AND status = 'paid'
    AND COALESCE(is_deleted, false) = false
  `;

  const monthly = await sql`
    SELECT COALESCE(SUM(amount),0) as total
    FROM payments
    WHERE doctor_id = ${doctorId}
      AND status = 'paid'
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      AND COALESCE(is_deleted, false) = false
  `;

  return {
    total_earnings: Number(total[0].total),
    today_earnings: Number(today[0].total),
    monthly_earnings: Number(monthly[0].total),
    online_earnings: Number(online[0].total),
    cash_earnings: Number(cash[0].total),
    total_paid_appointments: Number(count[0].total),
  };
}

export async function getDoctorRevenueDetails(doctorId) {
  const summary = await getDoctorEarningsSummary(doctorId);

  const recentPayments = await sql`
    SELECT
      p.id,
      p.amount,
      p.payment_method,
      p.status,
      p.created_at,
      p.appointment_id,
      pt.name AS patient_name,
      a.appointment_date,
      a.slot_time
    FROM payments p
    LEFT JOIN appointments a ON a.id = p.appointment_id
    LEFT JOIN patients pt ON pt.id = p.patient_id
    WHERE p.doctor_id = ${doctorId}
      AND p.status = 'paid'
      AND COALESCE(p.is_deleted, false) = false
    ORDER BY p.created_at DESC
    LIMIT 12
  `;

  const dailyRevenue = await sql`
    SELECT
      DATE(created_at) AS day,
      COUNT(*)::int AS payment_count,
      COALESCE(SUM(amount), 0)::numeric AS revenue
    FROM payments
    WHERE doctor_id = ${doctorId}
      AND status = 'paid'
      AND COALESCE(is_deleted, false) = false
      AND created_at >= CURRENT_DATE - INTERVAL '13 days'
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `;

  const methodBreakdown = await sql`
    SELECT
      payment_method,
      COUNT(*)::int AS payment_count,
      COALESCE(SUM(amount), 0)::numeric AS revenue
    FROM payments
    WHERE doctor_id = ${doctorId}
      AND status = 'paid'
      AND COALESCE(is_deleted, false) = false
    GROUP BY payment_method
    ORDER BY revenue DESC
  `;

  const monthComparison = await sql`
    SELECT
      COALESCE(
        SUM(amount) FILTER (
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        0
      )::numeric AS current_month,
      COALESCE(
        SUM(amount) FILTER (
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        ),
        0
      )::numeric AS previous_month
    FROM payments
    WHERE doctor_id = ${doctorId}
      AND status = 'paid'
      AND COALESCE(is_deleted, false) = false
  `;

  return {
    ...summary,
    current_month: Number(monthComparison[0]?.current_month || 0),
    previous_month: Number(monthComparison[0]?.previous_month || 0),
    daily_revenue: dailyRevenue.map((row) => ({
      day: row.day,
      payment_count: Number(row.payment_count || 0),
      revenue: Number(row.revenue || 0),
    })),
    method_breakdown: methodBreakdown.map((row) => ({
      payment_method: row.payment_method,
      payment_count: Number(row.payment_count || 0),
      revenue: Number(row.revenue || 0),
    })),
    recent_payments: recentPayments.map((row) => ({
      ...row,
      amount: Number(row.amount || 0),
    })),
  };
}
