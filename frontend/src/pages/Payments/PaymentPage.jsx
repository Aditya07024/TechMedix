import { useState, useEffect } from "react";
import { paymentApi } from "../../api";
import { appointmentAPI } from "../../api/techmedixAPI";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./PaymentPage.css";

export default function PaymentPage() {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appointment, setAppointment] = useState(null);

  // Validate appointment ID on mount
  useEffect(() => {
    if (!appointmentId) {
      setError("No appointment ID provided. Please book an appointment first.");
      setTimeout(() => navigate("/appointments"), 2000);
      return;
    }

    if (!user) {
      setError("You must be logged in to make a payment.");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    // load appointment details including fee
    async function fetchAppt() {
      try {
        const res = await appointmentAPI.get(appointmentId);
        setAppointment(res.data?.data || res.data);
      } catch (err) {
        console.warn("Failed to fetch appointment", err);
      }
    }
    fetchAppt();
  }, [appointmentId, user, navigate]);

  const handleOnlinePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate appointmentId is not empty
      if (!appointmentId || appointmentId.trim() === "") {
        setError("Invalid appointment ID.");
        setLoading(false);
        return;
      }

      console.log("Creating online payment with:", {
        appointment_id: appointmentId,
        payment_method: "online",
        user_id: user?.id,
      });

      const paymentRes = await paymentApi.createPayment({
        appointment_id: appointmentId,
        payment_method: "online",
      });

      const backendPaymentId = paymentRes.data.id;
      const order = paymentRes.data.order;

      if (!order || !order.id) {
        setError("Failed to create payment order. Please try again.");
        setLoading(false);
        return;
      }

      // 3️⃣ Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY,
        amount: order.amount,
        currency: "INR",
        name: "TechMedix",
        description: "Doctor Consultation Payment",
        order_id: order.id,
        handler: async function (response) {
          try {
            await paymentApi.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_id: backendPaymentId,
            });

            alert("Payment Successful!");
            navigate("/dashboard");
          } catch (verifyErr) {
            console.error("Payment verification error:", verifyErr);
            setError("Payment verification failed. Please contact support.");
          }
        },
        theme: {
          color: "#1976d2",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Payment error FULL:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        appointmentId: appointmentId,
      });

      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Payment creation failed. Please try again.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCashPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate appointmentId is not empty
      if (!appointmentId || appointmentId.trim() === "") {
        setError("Invalid appointment ID.");
        setLoading(false);
        return;
      }

      console.log("Creating CASH payment with:", {
        appointment_id: appointmentId,
        payment_method: "cash",
        user_id: user?.id,
      });

      const response = await paymentApi.createPayment({
        appointment_id: appointmentId,
        payment_method: "cash",
      });

      alert("Cash payment marked as pending. Pay at clinic.");
      navigate("/dashboard");
    } catch (error) {
      console.error("Cash payment error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        appointmentId: appointmentId,
      });

      const errorMessage =
        error.response?.data?.error ||
        "Failed to process cash payment. Please try again.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-page">
      <h2 className="payment-title">Choose Payment Method</h2>

      {error && (
        <div
          className="error-message"
          style={{
            marginBottom: "20px",
            padding: "12px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c33",
          }}
        >
          <p>
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {!appointmentId ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#fef3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
          }}
        >
          <p>Invalid appointment ID. Redirecting...</p>
        </div>
      ) : !user ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#fef3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
          }}
        >
          <p>You must be logged in to proceed. Redirecting...</p>
        </div>
      ) : (
        <>
          {appointment && (
            <div className="appointment-summary">
              <p>
                <strong>Doctor:</strong> Dr. {appointment.doctor_name}
              </p>
              {/* <p>
                <strong>Consultation Fee:</strong> ₹
                {appointment.consultation_fee}
              </p> */}
            </div>
          )}
          <button
            className="payment-btn online"
            onClick={handleOnlinePayment}
            disabled={loading}
          >
            {loading ? "Processing..." : "Pay Online (Razorpay)"}
          </button>

          <button
            className="payment-btn cash"
            onClick={handleCashPayment}
            disabled={loading}
          >
            {loading ? "Processing..." : "Pay at Clinic (Cash)"}
          </button>
        </>
      )}
    </div>
  );
}
