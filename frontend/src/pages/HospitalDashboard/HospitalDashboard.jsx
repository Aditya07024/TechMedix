import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hospitalApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import {
  Building,
  Users,
  CreditCard,
  UserPlus,
  Trash2,
  LogOut,
  Mail,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Briefcase,
  Layers,
  MapPin,
  Phone,
  X,
  Loader2,
  Shield,
  Zap
} from "lucide-react";
import "./HospitalDashboard.css";

const HospitalDashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingLink, setSubmittingLink] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [linkRequests, setLinkRequests] = useState([]);
  const [performance, setPerformance] = useState(null);

  // ── Payment modal state ──────────────────────────────
  const [paymentModal, setPaymentModal] = useState(null); // { plan } | null
  const [payPhone, setPayPhone] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [profileRes, subRes, doctorsRes, plansRes, reqsRes, perfRes] = await Promise.allSettled([
        hospitalApi.getProfile(),
        import("../../api").then((module) => module.default.get("/api/v2/hospitals/subscription")),
        hospitalApi.getLinkedDoctors(),
        hospitalApi.getHospitalPlans(),
        hospitalApi.getSentLinkRequests(),
        hospitalApi.getDoctorsPerformance()
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.data?.data || null);
      }
      if (subRes.status === "fulfilled") {
        setSubscription(subRes.value.data?.data || null);
      }
      if (doctorsRes.status === "fulfilled") {
        setDoctors(doctorsRes.value.data?.data || []);
      }
      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data?.data || []);
      }
      if (reqsRes.status === "fulfilled") {
        setLinkRequests(reqsRes.value.data?.data || []);
      }
      if (perfRes.status === "fulfilled") {
        setPerformance(perfRes.value.data?.data || null);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setErrorMessage("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Inject Cashfree SDK if not already present
  useEffect(() => {
    if (!document.getElementById("cashfree-sdk")) {
      const script = document.createElement("script");
      script.id = "cashfree-sdk";
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const handleLinkDoctor = async (e) => {
    e.preventDefault();
    if (!doctorEmail.trim()) return;

    setErrorMessage("");
    setStatusMessage("");
    setSubmittingLink(true);

    try {
      const res = await hospitalApi.linkDoctor(doctorEmail);
      setStatusMessage(res.data?.message || "Doctor linked successfully!");
      setDoctorEmail("");
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || err.message || "Failed to link doctor."
      );
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleUnlinkDoctor = async (doctorId, doctorName) => {
    if (!window.confirm(`Unlink Dr. ${doctorName}? They will lose hospital subscription coverage.`)) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");

    try {
      const res = await hospitalApi.unlinkDoctor(doctorId);
      setStatusMessage(res.data?.message || "Doctor unlinked successfully.");
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || err.message || "Failed to unlink doctor."
      );
    }
  };

  // Open payment modal for a plan
  const handleSelectPlan = (plan) => {
    setPaymentModal(plan);
    setPayPhone(profile?.phone || "");
    setPayError("");
  };

  // Execute Cashfree payment flow
  const handleInitiatePayment = async () => {
    if (!paymentModal) return;
    setPayLoading(true);
    setPayError("");
    try {
      // Step 1: Create Cashfree order
      const initRes = await hospitalApi.initiateSubscriptionPayment(
        paymentModal.id,
        payPhone
      );
      const { payment_session_id, cashfree_order_id, cashfree_mode } =
        initRes.data;

      if (!payment_session_id) {
        throw new Error("Failed to create payment session.");
      }

      // Step 2: Launch Cashfree checkout modal
      const cashfreeMode =
        cashfree_mode === "production" ? "production" : "sandbox";
      const cashfree = window.Cashfree({ mode: cashfreeMode });

      const result = await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: "_modal",
      });

      if (result?.error) {
        throw new Error(result.error.message || "Payment was not completed.");
      }

      // Step 3: Verify and activate subscription
      const verifyRes = await hospitalApi.verifySubscriptionPayment(
        cashfree_order_id,
        paymentModal.id
      );

      const msg =
        verifyRes.data?.message || `Subscribed to ${paymentModal.name}!`;
      setStatusMessage(msg);
      setPaymentModal(null);
      await loadDashboardData();
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Payment failed.";
      setPayError(msg);
    } finally {
      setPayLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/hospital/login");
  };

  if (loading) {
    return (
      <div className="hospital-dashboard-loading">
        <div className="loading-card">
          <div className="spinner"></div>
          <h2>Accessing Institutional Workspace...</h2>
          <p>Setting up your hospital portal and linked doctor slots.</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const maxDoctors = subscription ? subscription.max_doctors : 0;
  const linkedCount = doctors.length;
  const slotsRemaining = maxDoctors - linkedCount;
  const isSubActive = subscription && subscription.status === "active";
  const daysLeft = subscription && subscription.end_date
    ? Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="hospital-dashboard">
      <div className="hospital-dashboard-container">
        {/* TOP COMMAND BAR */}
        <header className="hospital-header">
          <div className="header-info">
            <span className="kicker">Corporate Institutional Workspace</span>
            <h1>{profile?.name || "Hospital Workspace"}</h1>
            <p className="subtext">
              Link healthcare practitioners, upgrade active doctor packages, and manage team coverage.
            </p>
          </div>
        </header>

        {/* FEEDBACK BANNERS */}
        {statusMessage && (
          <div className="dashboard-banner success-banner">
            <CheckCircle2 size={18} />
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage("")}>Dismiss</button>
          </div>
        )}
        {errorMessage && (
          <div className="dashboard-banner error-banner">
            <ShieldAlert size={18} />
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")}>Dismiss</button>
          </div>
        )}

        {/* OVERVIEW STATS CARDS */}
        <section className="stats-row">
          <div className="stat-card">
            <div className="stat-icon red-icon">
              <Building size={20} />
            </div>
            <div className="stat-data">
              <span>Subscription Plan</span>
              <h3>{isSubActive ? subscription.plan_name : "No Active Plan"}</h3>
              <p>{isSubActive ? `Valid for ${daysLeft} days` : "Bypassed / Expired"}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue-icon">
              <Users size={20} />
            </div>
            <div className="stat-data">
              <span>Linked Doctors</span>
              <h3>{linkedCount} / {isSubActive ? maxDoctors : "0"}</h3>
              <p>{isSubActive ? `${slotsRemaining} slots remaining` : "Subscribe to link doctors"}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green-icon">
              <Calendar size={20} />
            </div>
            <div className="stat-data">
              <span>Expiry Date</span>
              <h3>{isSubActive && subscription.end_date ? new Date(subscription.end_date).toLocaleDateString() : "N/A"}</h3>
              <p>{isSubActive ? "Auto-renew disabled" : "Please select a plan below"}</p>
            </div>
          </div>
        </section>

        {/* METRICS AGGREGATE PANEL (Task 7) */}
        {isSubActive && performance && (
          <section className="stats-row mt-4" style={{ marginTop: "24px" }}>
            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(79, 114, 240, 0.05), rgba(79, 114, 240, 0.02))", border: "1px solid rgba(79, 114, 240, 0.15)" }}>
              <div className="stat-icon blue-icon" style={{ background: "rgba(79, 114, 240, 0.1)", color: "#4f72f0" }}>
                <Calendar size={20} />
              </div>
              <div className="stat-data">
                <span>Total Consultations</span>
                <h3>{performance.aggregate?.total_appointments || 0}</h3>
                <p>Across all linked practitioners</p>
              </div>
            </div>

            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(16, 124, 65, 0.05), rgba(16, 124, 65, 0.02))", border: "1px solid rgba(16, 124, 65, 0.15)" }}>
              <div className="stat-icon green-icon">
                <CreditCard size={20} />
              </div>
              <div className="stat-data">
                <span>Total Doctor Revenue</span>
                <h3>₹{Number(performance.aggregate?.total_earnings || 0).toLocaleString("en-IN")}</h3>
                <p>Aggregated fees earnings</p>
              </div>
            </div>

            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.02))", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
              <div className="stat-icon yellow-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-data">
                <span>Average Review Rating</span>
                <h3>{performance.aggregate?.average_rating ? `${performance.aggregate.average_rating} ★` : "N/A"}</h3>
                <p>Aggregated patient feedback</p>
              </div>
            </div>
          </section>
        )}

        {/* MAIN PANEL GRID */}
        <div className="dashboard-grid">
          {/* LEFT: DOCTOR LINKING & LIST */}
          <main className="dashboard-main-panel">
            {/* LINK DOCTOR CARD */}
            <div className="hospital-panel">
              <div className="panel-title">
                <UserPlus size={20} />
                <h2>Link Doctor to Subscription</h2>
              </div>
              <p className="panel-hint">
                Enter the email of a doctor registered on TechMedix. Linking them automatically assigns them to your hospital's package, bypassing individual dashboard billing limits.
              </p>
              <form onSubmit={handleLinkDoctor} className="link-form">
                <div className="input-group">
                  <Mail size={18} />
                  <input
                    type="email"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="doctor@techmedix.com"
                    required
                    disabled={submittingLink || !isSubActive}
                  />
                </div>
                <button type="submit" disabled={submittingLink || !isSubActive || slotsRemaining <= 0} className="link-btn">
                  {submittingLink ? "Linking..." : "Link Doctor"}
                </button>
              </form>
              {!isSubActive && (
                <p className="alert-text">🔒 You must subscribe to a hospital plan before linking doctors.</p>
              )}
              {isSubActive && slotsRemaining <= 0 && (
                <p className="alert-text">⚠️ All doctor slots are filled. Upgrade your subscription package to link more doctors.</p>
              )}
            </div>

            {/* DOCTORS TABLE CARD */}
            <div className="hospital-panel mt-4">
              <div className="panel-title">
                <Users size={20} />
                <h2>Linked Practitioners ({linkedCount})</h2>
              </div>
              {doctors.length === 0 ? (
                <div className="empty-doctors-state">
                  <Building size={32} />
                  <p>No doctors linked to your hospital yet.</p>
                </div>
              ) : (
                <div className="doctors-table-container">
                  <table className="doctors-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialty</th>
                        <th style={{ textAlign: "center" }}>Appointments</th>
                        <th style={{ textAlign: "right" }}>Total Earnings</th>
                        <th style={{ textAlign: "center" }}>Avg Rating</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((doc) => {
                        const perf = performance?.doctors?.find((p) => p.id === doc.id) || {};
                        return (
                          <tr key={doc.id}>
                            <td>
                              <strong>Dr. {doc.name}</strong>
                              <span style={{ display: "block", fontSize: "0.78rem", color: "var(--hospital-muted)", fontWeight: "normal" }}>
                                {doc.email}
                              </span>
                            </td>
                            <td><span className="specialty-badge">{doc.specialty || "General"}</span></td>
                            <td style={{ textAlign: "center", fontWeight: "600" }}>{perf.total_appointments || 0}</td>
                            <td style={{ textAlign: "right", fontWeight: "600", color: "var(--hospital-success)" }}>
                              ₹{Number(perf.total_earnings || 0).toLocaleString("en-IN")}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span style={{
                                background: perf.average_rating ? "rgba(245, 158, 11, 0.12)" : "transparent",
                                color: "#d97706",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "0.82rem",
                                fontWeight: "600"
                              }}>
                                {perf.average_rating ? `${perf.average_rating} ★` : "—"}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleUnlinkDoctor(doc.id, doc.name)}
                                className="unlink-btn-icon"
                                title="Unlink Doctor"
                              >
                                <Trash2 size={16} />
                                Unlink
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* SENT LINK REQUESTS CARD */}
            <div className="hospital-panel mt-4">
              <div className="panel-title">
                <Users size={20} />
                <h2>Sent Link Requests ({linkRequests.length})</h2>
              </div>
              <p className="panel-hint" style={{ marginTop: "6px" }}>
                Pending doctor approvals. Doctors must log into their TechMedix dashboards to accept or reject hospital coverage invites.
              </p>
              <p><b>Doctor Will find the request will be find in Subscription & Hospital Link</b></p>
              {linkRequests.length === 0 ? (
                <div className="empty-doctors-state" style={{ padding: "20px" }}>
                  <p>No sent requests found.</p>
                </div>
              ) : (
                <div className="doctors-table-container">
                  <table className="doctors-table">
                    <thead>
                      <tr>
                        <th>Doctor Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Sent On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkRequests.map((req) => (
                        <tr key={req.id}>
                          <td><strong>Dr. {req.doctor_name}</strong></td>
                          <td>{req.doctor_email}</td>
                          <td>
                            <span className={`status-badge-val ${req.status}`}>
                              {req.status === "pending" ? "Pending Approval" :
                               req.status === "accepted" ? "Accepted" : "Rejected"}
                            </span>
                          </td>
                          <td>{new Date(req.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>

          {/* RIGHT: PLANS & DETAILS */}
          <aside className="dashboard-sidebar-panel">
            {/* HOSPITAL PACKAGES CARD */}
            <div className="hospital-panel">
              <div className="panel-title">
                <CreditCard size={20} />
                <h2>Hospital Subscription Packages</h2>
              </div>
              <p className="panel-hint">
                Select from our hospital plans. Each package covers a specified slot of doctors under a central subscription.
              </p>
              <div className="plans-list">
                {plans.length === 0 ? (
                  <p className="empty-state">No hospital subscription packages available. Contact TechMedix Admin.</p>
                ) : (
                  plans.map((p) => {
                    const isCurrent = subscription && subscription.plan_id === p.id && isSubActive;
                    return (
                      <div key={p.id} className={`plan-item-card ${isCurrent ? "active-plan" : ""}`}>
                        <div className="plan-item-head">
                          <h4>{p.name}</h4>
                          <span className="price-tag">₹{Number(p.price).toLocaleString("en-IN")}/mo</span>
                        </div>
                        <div className="plan-item-meta">
                          <span>Slots: <strong>{p.max_doctors} Doctors</strong></span>
                          <span>Duration: <strong>{p.duration_days} days</strong></span>
                        </div>
                        {Array.isArray(p.features) && p.features.length > 0 && (
                          <ul className="plan-item-features">
                            {p.features.map((feat, i) => (
                              <li key={i}>✓ {feat}</li>
                            ))}
                          </ul>
                        )}
                        <button
                          onClick={() => handleSelectPlan(p)}
                          disabled={isCurrent}
                          className={`plan-select-btn ${isCurrent ? "current-btn" : ""}`}
                        >
                          {isCurrent ? "✓ Active Package" : "Activate Package"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* HOSPITAL DETAILS CARD */}
            <div className="hospital-panel mt-4">
              <div className="panel-title">
                <Building size={20} />
                <h2>Institution Details</h2>
              </div>
              <div className="hospital-details-list">
                <div className="detail-item">
                  <Building size={16} />
                  <div>
                    <span>Official Name</span>
                    <strong>{profile?.name}</strong>
                  </div>
                </div>
                <div className="detail-item">
                  <Mail size={16} />
                  <div>
                    <span>Official Email</span>
                    <strong>{profile?.email}</strong>
                  </div>
                </div>
                {profile?.phone && (
                  <div className="detail-item">
                    <Phone size={16} />
                    <div>
                      <span>Phone</span>
                      <strong>{profile.phone}</strong>
                    </div>
                  </div>
                )}
                {profile?.address && (
                  <div className="detail-item">
                    <MapPin size={16} />
                    <div>
                      <span>Address</span>
                      <strong>{profile.address}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── PAYMENT MODAL ────────────────────────────── */}
      {paymentModal && (
        <div className="hosp-pay-overlay" onClick={() => !payLoading && setPaymentModal(null)}>
          <div className="hosp-pay-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="hosp-pay-close"
              onClick={() => !payLoading && setPaymentModal(null)}
              disabled={payLoading}
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="hosp-pay-header">
              <div className="hosp-pay-icon">
                <Shield size={28} />
              </div>
              <h2>Activate Hospital Package</h2>
              <p>Secure your institutional subscription via Cashfree</p>
            </div>

            {/* Plan Summary */}
            <div className="hosp-pay-plan-card">
              <div className="hosp-pay-plan-name">
                <Zap size={16} />
                <span>{paymentModal.name}</span>
              </div>
              <div className="hosp-pay-plan-details">
                <div className="hosp-pay-detail">
                  <span>Doctor Slots</span>
                  <strong>{paymentModal.max_doctors} Doctors</strong>
                </div>
                <div className="hosp-pay-detail">
                  <span>Duration</span>
                  <strong>{paymentModal.duration_days} Days</strong>
                </div>
                <div className="hosp-pay-detail">
                  <span>Total Amount</span>
                  <strong className="hosp-pay-amount">₹{Number(paymentModal.price).toLocaleString("en-IN")}</strong>
                </div>
              </div>
              {Array.isArray(paymentModal.features) && paymentModal.features.length > 0 && (
                <ul className="hosp-pay-features">
                  {paymentModal.features.map((f, i) => (
                    <li key={i}><CheckCircle2 size={13} /> {f}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Phone number */}
            <div className="hosp-pay-field">
              <label htmlFor="hosp-pay-phone">Contact Phone for Payment</label>
              <div className="hosp-pay-input-wrap">
                <Phone size={16} />
                <input
                  id="hosp-pay-phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  maxLength={10}
                  disabled={payLoading}
                />
              </div>
              <p className="hosp-pay-field-hint">Used for payment OTP and receipt. Leave blank to use registered number.</p>
            </div>

            {/* Error */}
            {payError && (
              <div className="hosp-pay-error">
                <ShieldAlert size={16} />
                <span>{payError}</span>
              </div>
            )}

            {/* CTA */}
            <button
              className="hosp-pay-cta"
              onClick={handleInitiatePayment}
              disabled={payLoading}
            >
              {payLoading ? (
                <><Loader2 size={18} className="spin-icon" /> Processing...</>
              ) : (
                <><CreditCard size={18} /> Pay ₹{Number(paymentModal.price).toLocaleString("en-IN")} via Cashfree</>
              )}
            </button>

            <p className="hosp-pay-secure">🔒 Secured & encrypted payment by Cashfree. No card data stored on TechMedix servers.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;
