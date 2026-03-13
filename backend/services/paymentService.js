import sql from "../config/database.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Payment Entry
export async function createPayment(
  appointmentId,
  paymentMethod,
  patientIdFromAuth,
) {
  try {
    // Type validation
    if (
      !appointmentId ||
      typeof appointmentId !== "string" ||
      appointmentId.trim() === ""
    ) {
      throw new Error("Invalid appointment ID");
    }

    if (!paymentMethod) {
      throw new Error("Payment method is required");
    }

    console.log("Creating payment for:", {
      appointmentId,
      paymentMethod,
      patientIdFromAuth,
    });

    const appointment = await sql`
      SELECT * FROM appointments
      WHERE id = ${appointmentId}
    `;

    if (appointment.length === 0) {
      throw new Error("Appointment not found");
    }

    // Verify the appointment belongs to the logged-in patient
    if (patientIdFromAuth && appointment[0].patient_id !== patientIdFromAuth) {
      console.warn("Authorization check failed:", {
        appointmentPatientId: appointment[0].patient_id,
        authPatientId: patientIdFromAuth,
      });
      throw new Error("You can only pay for your own appointments");
    }

    // Only block payment if appointment is cancelled or completed
    if (["cancelled", "completed"].includes(appointment[0].status)) {
      console.log("Appointment status:", appointment[0].status);
      throw new Error("Appointment not eligible for payment");
    }

    const existingPayment = await sql`
      SELECT * FROM payments
      WHERE appointment_id = ${appointmentId}
        AND status IN ('pending','paid')
    `;

    // If a pending payment already exists, recreate a Razorpay order for it
    if (existingPayment.length > 0 && existingPayment[0].status === "pending") {
      let razorpayOrder = null;

      if (paymentMethod === "online") {
        // fetch up-to-date consultation fee in case doctor changed it
        const doc = await sql`
          SELECT consultation_fee FROM doctors
          WHERE id = ${appointment[0].doctor_id}
        `;
        const fee = Number(doc[0]?.consultation_fee) || 500;
        const razorAmount = fee * 100;

        // Create a short receipt within 40-char limit
        // Format: "rcpt_" + first 8 chars of appointmentId + timestamp (last 8 digits)
        const shortReceipt = `rcpt_${appointmentId.substring(0, 8)}_${Date.now().toString().slice(-8)}`;
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

    // Use patient id from auth if provided, otherwise fallback to appointment record
    const patient_id = patientIdFromAuth || appointment[0].patient_id;
    const doctor_id = appointment[0].doctor_id;

    const doctor = await sql`
      SELECT consultation_fee FROM doctors
      WHERE id = ${doctor_id}
    `;

    if (!doctor.length) {
      console.error("Doctor not found for payment", {
        doctor_id,
        appointmentId,
      });
      throw new Error("Doctor not found for this appointment");
    }

    // Use doctor's consultation fee instead of fixed amount
    const amount = Number(doctor[0].consultation_fee) || 500;

    let razorpayOrderId = null;
    let razorpayOrder = null;

    if (paymentMethod === "online") {
      // convert to paise for Razorpay
      const razorAmount = amount * 100;

      // Create a short receipt within 40-char limit
      // Format: "rcpt_" + first 8 chars of appointmentId + timestamp (last 8 digits)
      const shortReceipt = `rcpt_${appointmentId.substring(0, 8)}_${Date.now().toString().slice(-8)}`;
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
        appointmentId,
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
  razorpay_order_id
)
VALUES (
  ${appointmentId},
  ${patient_id},
  ${doctor_id},
  ${amount},
  'INR',
  ${paymentMethod},
  ${paymentMethod === 'cash' ? 'due' : 'pending'},
  ${razorpayOrderId}
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
      appointmentId,
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
    await sql`
      UPDATE payments
      SET status = 'paid',
          razorpay_payment_id = ${razorpayPaymentId},
          razorpay_signature = ${razorpaySignature}
      WHERE razorpay_order_id = ${razorpayOrderId}
    `;
    console.log("Payment status updated successfully");
  } catch (updateError) {
    console.error("Failed to update payment status:", updateError);
    throw new Error(`Payment update failed: ${updateError.message}`);
  }

  console.log("Updating appointment status...");

  try {
    await sql`
      UPDATE appointments
      SET status = 'booked'
      WHERE id = ${payment[0].appointment_id}
    `;
    console.log("Appointment status updated successfully");
  } catch (apptUpdateError) {
    console.error("Failed to update appointment status:", apptUpdateError);
    throw new Error(`Appointment update failed: ${apptUpdateError.message}`);
  }

  console.log("Payment confirmation completed successfully");

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
