import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { paymentApi, patientApi } from "../../api";
import { appointmentAPI } from "../../api/techmedixAPI";
import { useAuth } from "../../context/AuthContext";
import "./PaymentPage.css";

const getNormalizedPhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(-10);

const getRazorpayContact = (value) => {
  const phone = getNormalizedPhone(value);
  return phone ? `+91${phone}` : "";
};

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

export default function PaymentPage() {
  const { appointmentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookingIntent, setBookingIntent] = useState(() => {
    const stateIntent = location.state?.bookingIntent;
    if (stateIntent) return stateIntent;

    try {
      const stored = sessionStorage.getItem("pending-booking-intent");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [checkoutProfile, setCheckoutProfile] = useState(null);
  const [lastOrderAmount, setLastOrderAmount] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);

  const hasBookingIntent = Boolean(bookingIntent?.doctor_id);

  useEffect(() => {
    if (location.state?.bookingIntent) {
      sessionStorage.setItem(
        "pending-booking-intent",
        JSON.stringify(location.state.bookingIntent),
      );
      setBookingIntent(location.state.bookingIntent);
    }
  }, [location.state]);

  useEffect(() => {
    if (authLoading) return;

    if (!appointmentId && !hasBookingIntent) {
      setError("No appointment ID provided. Please book an appointment first.");
      setTimeout(() => navigate("/dashboard"), 2000);
      return;
    }

    if (!user) {
      setError("You must be logged in to make a payment.");
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    async function fetchLatestPatientProfile() {
      try {
        if (user?.id) {
          const res = await patientApi.getPatient(user.id);
          setCheckoutProfile(res.data || null);
        }
      } catch (err) {
        console.warn("Failed to fetch latest patient profile for checkout", err);
      }
    }

    async function fetchWallet() {
      try {
        const res = await paymentApi.getWalletBalance();
        setWallet({ balance: Number(res.data?.balance || 0) });
      } catch (err) {
        console.warn("Failed to fetch wallet balance", err);
      }
    }

    async function fetchAppt() {
      if (!appointmentId || hasBookingIntent) return;

      try {
        const res = await appointmentAPI.get(appointmentId);
        setAppointment(res.data?.data || res.data);
      } catch (err) {
        console.warn("Failed to fetch appointment", err);
      }
    }

    fetchAppt();
    fetchLatestPatientProfile();
    fetchWallet();
  }, [appointmentId, user, navigate, authLoading, hasBookingIntent]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const paymentTrigger = queryParams.get("payment_trigger");
    const cfOrderId = queryParams.get("cf_order_id");
    const paymentId = queryParams.get("payment_id");

    if (paymentTrigger === "cashfree" && cfOrderId && paymentId) {
      async function autoVerify() {
        try {
          setLoading(true);
          setError("Verifying payment status, please wait...");
          await paymentApi.verifyCashfreePayment({
            order_id: cfOrderId,
            payment_id: paymentId,
          });
          alert("Payment Successful!");
          clearBookingIntent();
          navigate("/dashboard");
        } catch (verifyErr) {
          console.error("Auto-verification error:", verifyErr);
          setError("Payment verification failed. Please check your payment status.");
        } finally {
          setLoading(false);
        }
      }
      autoVerify();
    }
  }, [location.search, navigate]);

  const checkoutIdentity = {
    name:
      checkoutProfile?.name ||
      checkoutProfile?.full_name ||
      user?.name ||
      user?.full_name ||
      "",
    email: checkoutProfile?.email || user?.email || "",
    phone: getNormalizedPhone(checkoutProfile?.phone || user?.phone),
    razorpayContact: getRazorpayContact(checkoutProfile?.phone || user?.phone),
  };

  const consultationFee = Number(
    appointment?.consultation_fee || bookingIntent?.consultationFee || 0,
  );
  const billingAmount =
    lastOrderAmount != null ? Number(lastOrderAmount) / 100 : consultationFee;
  const walletBalance = Number(wallet?.balance || 0);
  const walletInsufficient = walletBalance < consultationFee;
  const doctorName = appointment?.doctor_name
    ? `Dr. ${String(appointment.doctor_name).replace(/^Dr\.?\s*/i, "")}`
    : bookingIntent?.doctorName
      ? `Dr. ${String(bookingIntent.doctorName).replace(/^Dr\.?\s*/i, "")}`
      : "Doctor Assigned";

  const paymentPayload = hasBookingIntent
    ? {
        booking_details: {
          doctor_id: bookingIntent.doctor_id,
          appointment_date: bookingIntent.appointment_date,
          slot_time: bookingIntent.slot_time,
          share_history: Boolean(bookingIntent.share_history),
          share_history_scope: Array.isArray(bookingIntent.share_history_scope)
            ? bookingIntent.share_history_scope
            : [],
        },
      }
    : {
        appointment_id: appointmentId,
      };

  const clearBookingIntent = () => {
    sessionStorage.removeItem("pending-booking-intent");
    setBookingIntent(null);
  };

  const handleOnlinePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      const paymentRes =
        paymentSession?.order?.id && paymentSession?.payment_session_id
          ? { data: paymentSession }
          : await paymentApi.createPayment({
              ...paymentPayload,
              payment_method: "online",
            });

      const backendPaymentId = paymentRes.data.id;
      const order = paymentRes.data.order;
      const paymentSessionId = paymentRes.data.payment_session_id;
      const cashfreeMode = paymentRes.data.cashfree_mode || import.meta.env.VITE_CASHFREE_MODE || "sandbox";

      setLastOrderAmount(paymentRes.data.amount ? Number(paymentRes.data.amount) * 100 : null);
      setPaymentSession(paymentRes.data);

      if (!paymentSessionId) {
        setError("Failed to create payment session. Please try again.");
        return;
      }

      // Initialize Cashfree
      const cashfree = window.Cashfree({
        mode: cashfreeMode === "production" ? "production" : "sandbox",
      });

      // Trigger checkout
      cashfree.checkout({
        paymentSessionId: paymentSessionId,
        redirectTarget: "_modal",
      }).then(async (result) => {
        // Cashfree promise resolves when checkout closes/redirects/completes
        // We will call the backend verification endpoint to check if the payment is successful
        try {
          setLoading(true);
          setError("Verifying payment, please wait...");
          await paymentApi.verifyCashfreePayment({
            order_id: paymentRes.data.razorpay_order_id || paymentRes.data.orderId || order?.id,
            payment_id: backendPaymentId,
          });

          alert("Payment Successful!");
          clearBookingIntent();
          navigate("/dashboard");
        } catch (verifyErr) {
          console.error("Payment verification error:", verifyErr);
          setError("Payment verification failed or was cancelled. Please check your payment status.");
        } finally {
          setLoading(false);
        }
      });
    } catch (err) {
      console.error("Payment error FULL:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        appointmentId: appointmentId || null,
        bookingIntent,
      });

      const errorMessage =
        (err.response?.status === 401
          ? "Your session expired. Please log in again before paying."
          : null) ||
        err.response?.data?.error ||
        err.message ||
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

      await paymentApi.createPayment({
        ...paymentPayload,
        payment_method: "cash",
      });

      clearBookingIntent();
      alert("Appointment booked. Pay at clinic.");
      navigate("/dashboard");
    } catch (err) {
      console.error("Cash payment error:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        appointmentId: appointmentId || null,
      });

      const errorMessage =
        (err.response?.status === 401
          ? "Your session expired. Please log in again before paying."
          : null) ||
        err.response?.data?.error ||
        "Failed to process cash payment. Please try again.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      await paymentApi.payWithWallet(paymentPayload);
      clearBookingIntent();
      alert("Paid with wallet successfully");
      navigate("/dashboard");
    } catch (err) {
      const errorMessage =
        (err.response?.status === 401
          ? "Your session expired. Please log in again before paying."
          : null) ||
        err.response?.data?.error ||
        err.message ||
        "Wallet payment failed.";

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-shell">
      <div className="payment-page">
        <div className="payment-hero">
          <span className="payment-badge">Secure consultation billing</span>
          <h1 className="payment-title">Choose Payment Method</h1>
          <p className="payment-subtitle">
            Confirm this appointment and continue with the payment option that
            works best for this visit.
          </p>
        </div>

        {error && (
          <div className="payment-alert payment-alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {authLoading ? (
          <div className="payment-alert payment-alert-info">
            Checking your session...
          </div>
        ) : !appointmentId && !hasBookingIntent ? (
          <div className="payment-alert payment-alert-warn">
            Invalid booking context. Redirecting...
          </div>
        ) : !user ? (
          <div className="payment-alert payment-alert-warn">
            You must be logged in to proceed. Redirecting...
          </div>
        ) : (
          <div className="payment-layout">
            <section className="payment-summary-card">
              <div className="payment-summary-head">
                <div>
                  <span className="summary-kicker">Appointment Summary</span>
                  <h2>Session Billing</h2>
                </div>
                <div className="payment-total-pill">
                  {formatCurrency(billingAmount)}
                </div>
              </div>

              <div className="payment-summary-list">
                <div className="summary-row">
                  <span>Doctor</span>
                  <strong>{doctorName}</strong>
                </div>
                <div className="summary-row">
                  <span>Consultation Fee</span>
                  <strong>{formatCurrency(consultationFee)}</strong>
                </div>
                <div className="summary-row">
                  <span>Billing this session</span>
                  <strong>{formatCurrency(billingAmount)}</strong>
                </div>
                <div className="summary-row">
                  <span>Wallet Balance</span>
                  <strong>{formatCurrency(walletBalance)}</strong>
                </div>
              </div>

            </section>

            <section className="payment-methods-card">
              <div className="payment-methods-head">
                <span className="summary-kicker">Payment Options</span>
                <h2>Select how you want to pay</h2>
              </div>

              <button
                type="button"
                className="payment-option payment-option-primary"
                onClick={handleOnlinePayment}
                disabled={loading}
              >
                <div>
                  <strong>Pay Online (Cashfree)</strong>
                  <span>
                    UPI, cards, net banking, and wallets with your saved contact
                    prefilled.
                  </span>
                </div>
                <b>{loading ? "Processing..." : formatCurrency(billingAmount)}</b>
              </button>

              <button
                type="button"
                className="payment-option"
                onClick={handleCashPayment}
                disabled={loading}
              >
                <div>
                  <strong>Pay at Clinic (Cash)</strong>
                  <span>Reserve this booking and settle the amount at the clinic.</span>
                </div>
                <b>{loading ? "Processing..." : "Due at visit"}</b>
              </button>

              <button
                type="button"
                className={`payment-option ${walletInsufficient ? "is-disabled" : "payment-option-wallet"}`}
                onClick={handleWalletPayment}
                disabled={loading || walletInsufficient}
              >
                <div>
                  <strong>
                    Pay with Wallet{walletInsufficient ? " (Insufficient)" : ""}
                  </strong>
                  <span>
                    {walletInsufficient
                      ? "Your wallet balance is lower than the consultation fee."
                      : "Use your available TechMedix wallet balance instantly."}
                  </span>
                </div>
                <b>{formatCurrency(walletBalance)}</b>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
