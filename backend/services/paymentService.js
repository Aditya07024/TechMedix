import sql from "../config/database.js";
import axios from "axios";
import crypto from "crypto";
import {
  bookAppointment,
  validateAppointmentBookingData,
} from "./appointmentService.js";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = CASHFREE_SECRET_KEY?.includes("_prod_")
  ? "production"
  : (CASHFREE_SECRET_KEY?.includes("_test_") ? "sandbox" : (process.env.CASHFREE_ENV || "sandbox"));

const cashfreeBaseUrl = CASHFREE_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

const getCashfreeHeaders = () => ({
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET_KEY,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json"
});

function getNormalizedPhoneForCashfree(phone) {
  const cleaned = String(phone || "").replace(/\D/g, "");
  return cleaned.slice(-10) || "9999999999";
}

// Create Payment Entry
export async function createPayment({
  appointmentId = null,
  paymentMethod,
  patientIdFromAuth,
  bookingDetails = null,
  customerPhone = null,
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

    // If a pending payment already exists, recreate a Cashfree order for it
    if (existingPayment.length > 0 && existingPayment[0].status === "pending") {
      let cashfreeOrder = null;

      if (paymentMethod === "online") {
        const baseFee = amount || Number(existingPayment[0]?.amount) || 500;
        const fee = Number(existingPayment[0]?.total_amount) || Number((baseFee * 1.025).toFixed(2));
        const gst = Number(existingPayment[0]?.gst_charges) || Number((baseFee * 0.02).toFixed(2));
        const platform = Number(existingPayment[0]?.platform_fees) || Number((baseFee * 0.005).toFixed(2));
        const receiptSource =
          resolvedAppointmentId ||
          `${doctor_id || "doc"}` + (bookingPayload?.appointment_date || "") + (bookingPayload?.slot_time || "");

        const orderId = `cf_ord_${String(receiptSource).replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}_${Date.now()}`;
        
        // Fetch patient details for customer object
        const patient = await sql`
          SELECT name, email, phone FROM patients WHERE id = ${patient_id}
        `;
        let phoneToUse = customerPhone || patient[0]?.phone;
        if (customerPhone) {
          const normalizedInput = getNormalizedPhoneForCashfree(customerPhone);
          const normalizedDb = patient[0]?.phone ? getNormalizedPhoneForCashfree(patient[0].phone) : null;
          if (normalizedInput && normalizedInput !== normalizedDb) {
            await sql`
              UPDATE patients
              SET phone = ${customerPhone}
              WHERE id = ${patient_id}
            `;
            console.log(`Updated phone number for patient ${patient_id} to ${customerPhone}`);
          }
          phoneToUse = customerPhone;
        }
        const customerEmail = patient[0]?.email || "patient@techmedix.com";
        const customerPhoneFinal = phoneToUse ? getNormalizedPhoneForCashfree(phoneToUse) : "9999999999";
        const customerName = patient[0]?.name || "Patient";

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
        const returnUrl = `${cleanFrontendUrl}/payment?payment_trigger=cashfree&cf_order_id={order_id}&payment_id=${existingPayment[0].id}`;

        const response = await axios.post(
          `${cashfreeBaseUrl}/orders`,
          {
            order_id: orderId,
            order_amount: Number(fee),
            order_currency: "INR",
            customer_details: {
              customer_id: String(patient_id),
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhoneFinal,
            },
            order_meta: {
              return_url: returnUrl
            }
          },
          {
            headers: getCashfreeHeaders()
          }
        );

        cashfreeOrder = response.data;
        console.log("Cashfree order recreated for existing payment", {
          orderId: cashfreeOrder.order_id,
          amount: cashfreeOrder.order_amount,
        });

        await sql`
          UPDATE payments
          SET razorpay_order_id = ${cashfreeOrder.order_id},
              gst_charges = ${gst},
              platform_fees = ${platform},
              total_amount = ${fee}
          WHERE id = ${existingPayment[0].id}
        `;
      }

      return {
        success: true,
        orderId: cashfreeOrder?.order_id,
        payment_session_id: cashfreeOrder?.payment_session_id,
        amount: cashfreeOrder?.order_amount,
        currency: cashfreeOrder?.order_currency,
        cashfree_mode: CASHFREE_ENV,
        ...existingPayment[0],
        order: cashfreeOrder,
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

    if (!patient_id || !doctor_id) {
      console.error("Invalid payment identifiers", {
        patient_id,
        doctor_id,
        appointmentId: resolvedAppointmentId,
      });
      throw new Error("Invalid payment identifiers");
    }

    let gst_charges = 0;
    let platform_fees = 0;
    let total_amount = amount;

    if (paymentMethod === "online") {
      gst_charges = Number((amount * 0.02).toFixed(2));
      platform_fees = Number((amount * 0.005).toFixed(2));
      total_amount = Number((amount * 1.025).toFixed(2));
    }

    const paymentResult = await sql`
      INSERT INTO payments (
        appointment_id,
        patient_id,
        doctor_id,
        amount,
        currency,
        payment_method,
        status,
        booking_payload,
        gst_charges,
        platform_fees,
        total_amount
      )
      VALUES (
        ${resolvedAppointmentId},
        ${patient_id},
        ${doctor_id},
        ${amount},
        'INR',
        ${paymentMethod},
        ${paymentMethod === 'cash' ? 'due' : 'pending'},
        ${bookingPayload ? sql.json(bookingPayload) : null},
        ${gst_charges},
        ${platform_fees},
        ${total_amount}
      )
      RETURNING *
    `;

    const insertedPayment = paymentResult[0];
    let cashfreeOrder = null;

    if (paymentMethod === "online") {
      const receiptSource =
        resolvedAppointmentId ||
        `${doctor_id || "doc"}` + (bookingPayload?.appointment_date || "") + (bookingPayload?.slot_time || "");

      const orderId = `cf_ord_${String(receiptSource).replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}_${Date.now()}`;
      
      const patient = await sql`
        SELECT name, email, phone FROM patients WHERE id = ${patient_id}
      `;
      let phoneToUse = customerPhone || patient[0]?.phone;
      if (customerPhone) {
        const normalizedInput = getNormalizedPhoneForCashfree(customerPhone);
        const normalizedDb = patient[0]?.phone ? getNormalizedPhoneForCashfree(patient[0].phone) : null;
        if (normalizedInput && normalizedInput !== normalizedDb) {
          await sql`
            UPDATE patients
            SET phone = ${customerPhone}
            WHERE id = ${patient_id}
          `;
          console.log(`Updated phone number for patient ${patient_id} to ${customerPhone}`);
        }
        phoneToUse = customerPhone;
      }
      const customerEmail = patient[0]?.email || "patient@techmedix.com";
      const customerPhoneFinal = phoneToUse ? getNormalizedPhoneForCashfree(phoneToUse) : "9999999999";
      const customerName = patient[0]?.name || "Patient";

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
      const returnUrl = `${cleanFrontendUrl}/payment?payment_trigger=cashfree&cf_order_id={order_id}&payment_id=${insertedPayment.id}`;

      const response = await axios.post(
        `${cashfreeBaseUrl}/orders`,
        {
          order_id: orderId,
          order_amount: Number(total_amount),
          order_currency: "INR",
          customer_details: {
            customer_id: String(patient_id),
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhoneFinal,
          },
          order_meta: {
            return_url: returnUrl
          }
        },
        {
          headers: getCashfreeHeaders()
        }
      );

      cashfreeOrder = response.data;
      console.log("Cashfree order created", {
        orderId: cashfreeOrder.order_id,
        amount: cashfreeOrder.order_amount,
      });

      // Update payment with Cashfree order ID
      const updatedPayment = await sql`
        UPDATE payments
        SET razorpay_order_id = ${cashfreeOrder.order_id},
            gst_charges = ${gst_charges},
            platform_fees = ${platform_fees},
            total_amount = ${total_amount}
        WHERE id = ${insertedPayment.id}
        RETURNING *
      `;
      
      return {
        success: true,
        orderId: cashfreeOrder.order_id,
        payment_session_id: cashfreeOrder.payment_session_id,
        amount: cashfreeOrder.order_amount,
        currency: cashfreeOrder.order_currency,
        cashfree_mode: CASHFREE_ENV,
        ...updatedPayment[0],
        order: cashfreeOrder,
      };
    }

    return {
      success: true,
      ...insertedPayment,
    };
  } catch (error) {
    let errorMessage = "Payment creation failed";

    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.error?.description) {
      errorMessage = error.error.description;
    } else if (error?.description) {
      errorMessage = error.description;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error?.sql) {
      errorMessage = error.detail || error.hint || "Database error occurred";
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    }

    console.error("Payment service error:", {
      message: errorMessage,
      appointmentId: resolvedAppointmentId,
      paymentMethod,
      fullError: error?.response?.data || JSON.stringify(error, null, 2),
    });
    throw new Error(errorMessage);
  }
}

export async function confirmOnlinePayment(
  orderId,
  paymentId = null,
) {
  console.log("Verifying Cashfree payment status", { orderId, paymentId });

  // Call Cashfree GET /orders/{order_id}
  let orderResponse;
  try {
    orderResponse = await axios.get(
      `${cashfreeBaseUrl}/orders/${orderId}`,
      {
        headers: getCashfreeHeaders()
      }
    );
  } catch (err) {
    console.error("Failed to fetch order details from Cashfree:", err.message);
    throw new Error(`Cashfree order lookup failed: ${err.message}`);
  }

  const { order_status, order_amount } = orderResponse.data;
  console.log("Cashfree order lookup success:", { order_status, order_amount });

  if (order_status !== "PAID") {
    throw new Error(`Payment is not completed. Status: ${order_status}`);
  }

  // Fetch successful transaction ID from Cashfree GET /orders/{order_id}/payments
  let transactionId = `cf_${orderId}`;
  try {
    const paymentsResponse = await axios.get(
      `${cashfreeBaseUrl}/orders/${orderId}/payments`,
      {
        headers: getCashfreeHeaders()
      }
    );
    const successPayment = paymentsResponse.data?.find(p => p.payment_status === "SUCCESS");
    if (successPayment?.cf_payment_id) {
      transactionId = String(successPayment.cf_payment_id);
    }
  } catch (err) {
    console.warn("Could not retrieve payments detail from Cashfree, using fallback transaction ID:", err.message);
  }

  console.log("Signature verification passed via secure API, looking up payment record...");

  const payment = await sql`
    SELECT * FROM payments
    WHERE razorpay_order_id = ${orderId}
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
    return { message: "Payment already confirmed", transaction_id: payment[0].razorpay_payment_id };
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
            razorpay_payment_id = ${transactionId},
            razorpay_signature = 'CASHFREE',
            appointment_id = COALESCE(${appointmentId}, appointment_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = ${orderId}
      `;

      if (appointmentId) {
        await tx`
          UPDATE appointments
          SET status = 'booked'
          WHERE id = ${appointmentId}
        `;
      }

      if (payment[0].payment_method === 'wallet_topup') {
        const wallets = await tx`
          INSERT INTO wallets (patient_id, balance)
          VALUES (${payment[0].patient_id}, 0)
          ON CONFLICT (patient_id)
          DO UPDATE SET updated_at = NOW()
          RETURNING id, balance
        `;
        const walletId = wallets[0].id;
        const amount = Number(payment[0].amount);
        
        await tx`
          UPDATE wallets
          SET balance = balance + ${amount}, updated_at = NOW()
          WHERE id = ${walletId}
        `;
        
        await tx`
          INSERT INTO wallet_transactions (wallet_id, patient_id, type, amount, source, reference_id, note)
          VALUES (${walletId}, ${payment[0].patient_id}, 'credit', ${amount}, 'wallet_topup', ${payment[0].id}, 'Wallet top-up via Cashfree')
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
      WHERE razorpay_order_id = ${orderId}
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
    transaction_id: transactionId,
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

export async function initiateWalletTopup({ amount, patientId, customerPhone = null }) {
  const topupAmount = Number(amount);
  if (!topupAmount || topupAmount <= 0) {
    throw new Error("Invalid amount to add");
  }

  // 1. Create a payment record of type 'wallet_topup'
  const paymentResult = await sql`
    INSERT INTO payments (
      appointment_id,
      patient_id,
      doctor_id,
      amount,
      currency,
      payment_method,
      status,
      booking_payload,
      gst_charges,
      platform_fees,
      total_amount
    )
    VALUES (
      null,
      ${patientId},
      null,
      ${topupAmount},
      'INR',
      'wallet_topup',
      'pending',
      null,
      0,
      0,
      ${topupAmount}
    )
    RETURNING *
  `;
  const insertedPayment = paymentResult[0];

  // 2. Generate a Cashfree order for it
  const receiptSource = `wallet_${patientId.substring(0, 8)}_${Date.now()}`;
  const orderId = `cf_ord_${String(receiptSource).replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)}_${Date.now()}`;

  const patient = await sql`
    SELECT name, email, phone FROM patients WHERE id = ${patientId}
  `;
  const phoneToUse = customerPhone || patient[0]?.phone;
  const customerEmail = patient[0]?.email || "patient@techmedix.com";
  const customerPhoneFinal = phoneToUse ? getNormalizedPhoneForCashfree(phoneToUse) : "9999999999";
  const customerName = patient[0]?.name || "Patient";

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;
  const returnUrl = `${cleanFrontendUrl}/payment?payment_trigger=cashfree&cf_order_id={order_id}&payment_id=${insertedPayment.id}`;

  const response = await axios.post(
    `${cashfreeBaseUrl}/orders`,
    {
      order_id: orderId,
      order_amount: Number(topupAmount),
      order_currency: "INR",
      customer_details: {
        customer_id: String(patientId),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhoneFinal,
      },
      order_meta: {
        return_url: returnUrl
      }
    },
    {
      headers: getCashfreeHeaders()
    }
  );

  const cashfreeOrder = response.data;
  console.log("Cashfree order created for wallet topup", {
    orderId: cashfreeOrder.order_id,
    amount: cashfreeOrder.order_amount,
  });

  const updatedPayment = await sql`
    UPDATE payments
    SET razorpay_order_id = ${cashfreeOrder.order_id}
    WHERE id = ${insertedPayment.id}
    RETURNING *
  `;

  return {
    success: true,
    orderId: cashfreeOrder.order_id,
    payment_session_id: cashfreeOrder.payment_session_id,
    amount: cashfreeOrder.order_amount,
    currency: cashfreeOrder.order_currency,
    cashfree_mode: CASHFREE_ENV,
    ...updatedPayment[0],
    order: cashfreeOrder,
  };
}
