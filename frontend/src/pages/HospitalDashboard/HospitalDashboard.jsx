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
  Zap,
  Percent
} from "lucide-react";
import "./HospitalDashboard.css";

const HospitalDashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [tempCommission, setTempCommission] = useState("20");
  const [savingCommission, setSavingCommission] = useState(false);
  const [editingCommission, setEditingCommission] = useState(false);

  const commissionRate = Number(profile?.commission_rate ?? 20);
  const commissionFactor = commissionRate / 100;
  const doctorShareRate = 100 - commissionRate;
  const doctorShareFactor = doctorShareRate / 100;
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

  // CA Invoices & Tab Switcher states
  const [activeTab, setActiveTab] = useState("practitioners"); // "practitioners" | "ca_billing"
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedHospInvoice, setSelectedHospInvoice] = useState(null);
  const [hospInvoiceSearchQuery, setHospInvoiceSearchQuery] = useState("");
  const [hospInvoiceSearchDoctor, setHospInvoiceSearchDoctor] = useState("");
  const [hospInvoiceFilterMethod, setHospInvoiceFilterMethod] = useState("all");

  // ── Payment modal state ──────────────────────────────
  const [paymentModal, setPaymentModal] = useState(null); // { plan } | null
  const [payPhone, setPayPhone] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [profileRes, subRes, doctorsRes, plansRes, reqsRes, perfRes, invoicesRes] = await Promise.allSettled([
        hospitalApi.getProfile(),
        import("../../api").then((module) => module.default.get("/api/v2/hospitals/subscription")),
        hospitalApi.getLinkedDoctors(),
        hospitalApi.getHospitalPlans(),
        hospitalApi.getSentLinkRequests(),
        hospitalApi.getDoctorsPerformance(),
        import("../../api").then((module) => module.default.get("/api/v2/hospitals/invoices"))
      ]);

      if (profileRes.status === "fulfilled") {
        const prof = profileRes.value.data?.data || null;
        setProfile(prof);
        if (prof?.commission_rate !== undefined) {
          setTempCommission(String(prof.commission_rate));
        }
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
      if (invoicesRes.status === "fulfilled") {
        setInvoices(invoicesRes.value.data?.data || []);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setErrorMessage("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommission = async () => {
    if (tempCommission === "" || isNaN(tempCommission)) {
      alert("Please enter a valid number");
      return;
    }
    const val = Number(tempCommission);
    if (val < 0 || val > 100) {
      alert("Commission percentage must be between 0% and 100%");
      return;
    }
    setSavingCommission(true);
    try {
      const res = await hospitalApi.updateProfile({ commission_rate: val });
      if (res.data?.success) {
        setProfile(res.data.data);
        alert("Hospital commission rate updated successfully!");
        setEditingCommission(false);
      } else {
        alert(res.data?.message || "Failed to update commission rate.");
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to update commission rate.");
    } finally {
      setSavingCommission(false);
    }
  };

  const handleExportHospCSV = (ledger) => {
    const headers = ["Invoice ID", "Date", "Doctor", "Patient", "Gross Amount (INR)", `Hospital Cut (${commissionRate}% INR)`, "Corporate GST (18% INR)", "Net Hospital Earnings (INR)", "Payment Method", "Status"];
    const rows = ledger.map(item => {
      const invId = `INV-${item.id.substring(0, 8).toUpperCase()}`;
      const date = new Date(item.created_at).toLocaleDateString();
      const docName = item.doctor_name || "Doctor";
      const patientName = item.patient_name || "Patient";
      const gross = Number(item.amount);
      const commission = Number((gross * 0.20).toFixed(2));
      const gst = Number((commission * 0.18).toFixed(2));
      const netEarnings = Number((commission - gst).toFixed(2));
      const method = item.payment_method;
      const status = "Paid";
      return [invId, date, docName, patientName, gross, commission, gst, netEarnings, method, status];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hospital_CA_Ledger_${(profile?.name || "Hospital").replace(/\s+/g, "_")}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        {/* Tab Switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--hospital-border, rgba(255,255,255,0.15))", marginBottom: "24px", gap: "24px" }}>
          <button
            onClick={() => setActiveTab("practitioners")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "practitioners" ? "2px solid #4f72f0" : "2px solid transparent",
              color: activeTab === "practitioners" ? "#4f72f0" : "var(--hospital-muted, #94a3b8)",
              padding: "12px 16px",
              fontWeight: "700",
              fontSize: "1.05rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Practitioners & Slots
          </button>
          <button
            onClick={() => setActiveTab("ca_billing")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "ca_billing" ? "2px solid #4f72f0" : "2px solid transparent",
              color: activeTab === "ca_billing" ? "#4f72f0" : "var(--hospital-muted, #94a3b8)",
              padding: "12px 16px",
              fontWeight: "700",
              fontSize: "1.05rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            CA Tax & Invoices
          </button>
        </div>

        {activeTab === "practitioners" && (
          <>
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
                <div className="detail-item">
                  <Percent size={16} />
                  <div>
                    <span>Hospital Commission Rate</span>
                    {editingCommission ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tempCommission}
                          onChange={(e) => setTempCommission(e.target.value)}
                          style={{
                            width: "60px",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid var(--hospital-border, rgba(255,255,255,0.15))",
                            backgroundColor: "rgba(0,0,0,0.3)",
                            color: "white",
                            fontSize: "0.85rem",
                            fontWeight: "700"
                          }}
                        />
                        <span style={{ color: "white" }}>%</span>
                        <button
                          onClick={handleSaveCommission}
                          disabled={savingCommission}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "#4f72f0",
                            color: "white",
                            border: "none",
                            fontSize: "0.75rem",
                            cursor: "pointer"
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingCommission(false);
                            setTempCommission(String(commissionRate));
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255,255,255,0.1)",
                            color: "white",
                            border: "none",
                            fontSize: "0.75rem",
                            cursor: "pointer"
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong>{commissionRate}%</strong>
                        <button
                          onClick={() => setEditingCommission(true)}
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: "transparent",
                            color: "#4f72f0",
                            border: "1px solid #4f72f0",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            fontWeight: "bold"
                          }}
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
          </>
        )}

        {activeTab === "ca_billing" && (
          <>
            {/* Corporate Billing Metrics */}
            <section className="stats-row">
              <div className="stat-card">
                <div className="stat-icon blue-icon">
                  <Building size={20} />
                </div>
                <div className="stat-data">
                  <span>Gross Corporate Revenue</span>
                  <h3>₹{Number(invoices.reduce((sum, item) => sum + Number(item.amount), 0)).toLocaleString("en-IN")}</h3>
                  <p>Consultations billing across all doctors</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green-icon">
                  <CreditCard size={20} />
                </div>
                <div className="stat-data">
                  <span>Hospital Cut (20% Split)</span>
                  <h3>₹{Number(invoices.reduce((sum, item) => sum + Number(item.amount), 0) * 0.20).toLocaleString("en-IN")}</h3>
                  <p>Institution service fee share</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon red-icon">
                  <Shield size={20} />
                </div>
                <div className="stat-data">
                  <span>Corporate GST (18%)</span>
                  <h3>₹{Number((invoices.reduce((sum, item) => sum + Number(item.amount), 0) * 0.20) * 0.18).toLocaleString("en-IN")}</h3>
                  <p>Estimated tax on service split</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon yellow-icon">
                  <CheckCircle2 size={20} />
                </div>
                <div className="stat-data">
                  <span>Net Institutional Earnings</span>
                  <h3>₹{Number((invoices.reduce((sum, item) => sum + Number(item.amount), 0) * 0.20) * 0.82).toLocaleString("en-IN")}</h3>
                  <p>Earnings after simulated tax levy</p>
                </div>
              </div>
            </section>

            {/* Corporate Invoice Grid */}
            <div className="dashboard-grid">
              <main className="dashboard-main-panel">
                <div className="hospital-panel">
                  <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Users size={20} />
                      <h2>Corporate Transaction Ledger</h2>
                    </div>
                    <button
                      className="link-btn"
                      style={{ padding: "8px 16px", borderRadius: "6px", fontSize: "0.85rem", cursor: "pointer" }}
                      onClick={() => handleExportHospCSV(invoices)}
                      disabled={invoices.length === 0}
                    >
                      Export Corporate Ledger (CSV)
                    </button>
                  </div>
                  <p className="panel-hint">
                    Patient consultations, billing details, payment methods, and GST tax invoice summaries across linked practitioners.
                  </p>

                  {/* Filters bar */}
                  <div style={{ display: "flex", gap: "12px", margin: "16px 0" }}>
                    <input
                      type="text"
                      placeholder="Search patient..."
                      value={hospInvoiceSearchQuery}
                      onChange={(e) => setHospInvoiceSearchQuery(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--hospital-border, rgba(255,255,255,0.15))", backgroundColor: "rgba(0,0,0,0.2)", color: "var(--hospital-text, #f8fafc)", outline: "none" }}
                    />
                    <input
                      type="text"
                      placeholder="Filter by Doctor..."
                      value={hospInvoiceSearchDoctor}
                      onChange={(e) => setHospInvoiceSearchDoctor(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--hospital-border, rgba(255,255,255,0.15))", backgroundColor: "rgba(0,0,0,0.2)", color: "var(--hospital-text, #f8fafc)", outline: "none" }}
                    />
                    <select
                      value={hospInvoiceFilterMethod}
                      onChange={(e) => setHospInvoiceFilterMethod(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--hospital-border, rgba(255,255,255,0.15))", backgroundColor: "rgba(0,0,0,0.2)", color: "var(--hospital-text, #f8fafc)", outline: "none" }}
                    >
                      <option value="all">All Methods</option>
                      <option value="online">Online</option>
                      <option value="cash">Cash</option>
                      <option value="wallet">Wallet</option>
                    </select>
                  </div>

                  {(() => {
                    const filtered = invoices.filter(item => {
                      const matchesSearch = (item.patient_name || "").toLowerCase().includes(hospInvoiceSearchQuery.toLowerCase());
                      const matchesDoctor = (item.doctor_name || "").toLowerCase().includes(hospInvoiceSearchDoctor.toLowerCase());
                      const matchesMethod = hospInvoiceFilterMethod === "all" || String(item.payment_method).toLowerCase() === hospInvoiceFilterMethod.toLowerCase();
                      return matchesSearch && matchesDoctor && matchesMethod;
                    });

                    return filtered.length > 0 ? (
                      <div className="doctors-table-container">
                        <table className="doctors-table">
                          <thead>
                            <tr>
                              <th>Invoice ID</th>
                              <th>Date</th>
                              <th>Doctor</th>
                              <th>Patient</th>
                              <th style={{ textAlign: "right" }}>Gross Fee</th>
                              <th style={{ textAlign: "right" }}>GST (18%)</th>
                              <th style={{ textAlign: "right" }}>Net Total</th>
                              <th>Method</th>
                              <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((item) => (
                              <tr key={item.id}>
                                <td><strong>INV-{item.id.substring(0, 8).toUpperCase()}</strong></td>
                                <td>{new Date(item.created_at).toLocaleDateString()}</td>
                                <td>Dr. {item.doctor_name}</td>
                                <td>{item.patient_name || "Patient"}</td>
                                <td style={{ textAlign: "right" }}>₹{Number(item.amount).toLocaleString("en-IN")}</td>
                                <td style={{ textAlign: "right" }}>₹{Number((item.amount * 0.20 * 0.18).toFixed(2)).toLocaleString("en-IN")}</td>
                                <td style={{ textAlign: "right", fontWeight: "600", color: "var(--hospital-success)" }}>
                                  ₹{Number(item.amount).toLocaleString("en-IN")}
                                </td>
                                <td><span className="specialty-badge" style={{ textTransform: "capitalize" }}>{item.payment_method}</span></td>
                                <td style={{ textAlign: "center" }}>
                                  <button
                                    onClick={() => setSelectedHospInvoice(item)}
                                    className="unlink-btn-icon"
                                    style={{ color: "#4f72f0", cursor: "pointer", display: "inline-flex", alignItems: "center", border: "none", background: "transparent", fontWeight: "bold" }}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-doctors-state" style={{ padding: "40px 0" }}>
                        <p>No invoices match your search criteria.</p>
                      </div>
                    );
                  })()}
                </div>
              </main>

              <aside className="dashboard-sidebar-panel">
                {/* Doctor Split Ledger */}
                <div className="hospital-panel">
                  <div className="panel-title">
                    <Users size={20} />
                    <h2>Practitioner Splits</h2>
                  </div>
                  <p className="panel-hint">
                    Summary of doctor consultations billing, payout shares (80%), and hospital cuts (20%).
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                    {doctors.map(doc => {
                      const docPayments = invoices.filter(inv => inv.doctor_name === doc.name);
                      const grossBilled = docPayments.reduce((sum, item) => sum + Number(item.amount), 0);
                      const splitPaid = grossBilled * 0.80;
                      const splitHosp = grossBilled * 0.20;

                      return (
                        <div key={doc.id} style={{ borderBottom: "1px solid var(--hospital-border, rgba(255,255,255,0.15))", paddingBottom: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <strong>Dr. {doc.name}</strong>
                            <span style={{ color: "var(--hospital-success)", fontWeight: "700" }}>₹{grossBilled.toLocaleString("en-IN")}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--hospital-muted)" }}>
                            <span>Consultations: {docPayments.length}</span>
                            <span>Hospital Share: ₹{splitHosp.toLocaleString("en-IN")}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--hospital-muted)", marginTop: "2px" }}>
                            <span>Payout (80%): ₹{splitPaid.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
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

      {/* Hospital Printable Invoice Modal */}
      {selectedHospInvoice && (
        <div className="hosp-pay-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setSelectedHospInvoice(null)}>
          <div className="hosp-pay-modal" style={{ width: "100%", maxWidth: "600px", background: "#1e293b", color: "#f8fafc" }} onClick={(e) => e.stopPropagation()}>
            <button
              className="hosp-pay-close"
              onClick={() => setSelectedHospInvoice(null)}
              style={{ color: "#94a3b8" }}
            >
              <X size={20} />
            </button>

            <div className="hosp-pay-header">
              <h2>Digital Consultation Invoice</h2>
              <p>Institutional record of practitioner consultation</p>
            </div>

            <div id="hosp-printable-invoice" style={{
              backgroundColor: "#ffffff",
              color: "#1e293b",
              padding: "24px",
              borderRadius: "8px",
              fontFamily: "Inter, sans-serif",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#4f72f0", fontSize: "1.2rem", fontWeight: "800" }}>TechMedix Clinical Sanctuary</h3>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}>124, Healthcare Boulevard, Medical District</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}><strong>Doctor Name:</strong> Dr. {selectedHospInvoice.doctor_name}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}><strong>Doctor Reg No:</strong> {selectedHospInvoice.doctor_reg_no || "TM-DOC-2024-001"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem", fontWeight: "800" }}>INVOICE</h3>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}><strong>Invoice ID:</strong> INV-{selectedHospInvoice.id.substring(0, 8).toUpperCase()}</p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "0.85rem", color: "#64748b" }}><strong>Date:</strong> {new Date(selectedHospInvoice.created_at).toLocaleDateString()}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#16a34a", fontWeight: "700" }}>STATUS: PAID</p>
                </div>
              </div>

              <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "16px 0" }} />

              <div style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                <strong style={{ color: "#475569" }}>Billed To:</strong>
                <p style={{ margin: "4px 0 0 0", fontWeight: "600" }}>{selectedHospInvoice.patient_name || "Patient"}</p>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginTop: "10px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                    <th style={{ padding: "8px 0", color: "#475569" }}>Description</th>
                    <th style={{ padding: "8px 0", textAlign: "right", color: "#475569" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px 0" }}>Medical Consultation (Dr. {selectedHospInvoice.doctor_name})</td>
                    <td style={{ padding: "12px 0", textAlign: "right" }}>₹{Number(selectedHospInvoice.amount).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "12px 0" }}>GST Charges (18% on Hospital 20% Split)</td>
                    <td style={{ padding: "12px 0", textAlign: "right" }}>₹{Number((selectedHospInvoice.amount * 0.20 * 0.18).toFixed(2)).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ fontSize: "1rem" }}>
                    <td style={{ padding: "16px 0 8px 0", fontWeight: "800" }}>Total Paid (INR)</td>
                    <td style={{ padding: "16px 0 8px 0", textAlign: "right", fontWeight: "800", color: "#4f72f0" }}>₹{Number(selectedHospInvoice.amount).toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: "30px", fontSize: "0.78rem", color: "#64748b", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                <p style={{ margin: 0 }}>Thank you for choosing TechMedix. This is a computer-generated tax invoice and requires no signature.</p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
              <button
                className="unlink-btn-icon"
                onClick={() => setSelectedHospInvoice(null)}
                style={{ padding: "8px 16px", border: "1px solid #475569", borderRadius: "6px", cursor: "pointer", background: "transparent", color: "white" }}
              >
                Close
              </button>
              <button
                className="link-btn"
                onClick={() => {
                  const printEl = document.getElementById("hosp-printable-invoice");
                  if (!printEl) return;
                  const printWindow = window.open("", "_blank");
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Print Invoice</title>
                        <style>
                          body { font-family: sans-serif; margin: 0; padding: 40px; color: #1e293b; background: #fff; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
                        </style>
                      </head>
                      <body>
                        <div style="border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px;">
                          ${printEl.innerHTML}
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            window.close();
                          };
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                style={{ padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
              >
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDashboard;
