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
  Phone
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [profileRes, subRes, doctorsRes, plansRes] = await Promise.allSettled([
        hospitalApi.getProfile(),
        hospitalApi.getProfile().then(() =>
          // Call the custom subscription details endpoint we mapped in backend
          // We can call getProfile or custom hospital API
          // Let's use getProfile response or dedicated request:
          // In hospitalRoutes: GET /api/v2/hospitals/subscription
          // Let's check how we mapped it: hospitalApi.getProfile or custom:
          // In frontend/src/api.js: hospitalApi.getLinkedDoctors, hospitalApi.getProfile, etc.
          // Wait! In api.js we mapped: getProfile, getLinkedDoctors, linkDoctor, unlinkDoctor, getHospitalPlans, subscribe.
          // Let's add a custom getHospitalSubscription call in api.js?
          // No need! We can call `api.get("/api/v2/hospitals/subscription")` directly or map it.
          // Wait! In frontend/src/api.js, hospitalApi has:
          // getProfile: () => api.get("/auth/hospital/profile"),
          // So let's look at what we put in hospitalApi in frontend/src/api.js.
          // We put:
          //   getProfile: () => api.get("/auth/hospital/profile"),
          //   updateProfile: (data) => api.patch("/auth/hospital/profile", data),
          //   getLinkedDoctors: () => api.get("/api/v2/hospitals/doctors"),
          //   linkDoctor: (email) => api.post("/api/v2/hospitals/link", { email }),
          //   unlinkDoctor: (doctorId) => api.post("/api/v2/hospitals/unlink", { doctor_id: doctorId }),
          //   getHospitalPlans: () => api.get("/api/v2/hospitals/plans"),
          //   subscribe: (planId) => api.post("/api/v2/hospitals/subscribe", { plan_id: planId }),
          // Ah! Let's check hospital subscription by calling a direct api request or modifying hospitalApi in api.js.
          // To fetch it cleanly, let's call api.get("/api/v2/hospitals/subscription") using the base api client:
          // since api is exported as default, we can do: import api from "../../api";
          // and call api.get("/api/v2/hospitals/subscription") directly! This is very clean and powerful.
          // Let's import it and use it.
          import("../../api").then((module) => module.default.get("/api/v2/hospitals/subscription"))
        ),
        hospitalApi.getLinkedDoctors(),
        hospitalApi.getHospitalPlans()
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

  const handleSelectPlan = async (planId, planName) => {
    if (!window.confirm(`Select the plan "${planName}"? This will activate this package for your hospital.`)) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");

    try {
      const res = await hospitalApi.subscribe(planId);
      setStatusMessage(res.data?.message || `Subscribed to ${planName}!`);
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || err.message || "Subscription failed."
      );
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
                        <th>Email</th>
                        <th>Specialty</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((doc) => (
                        <tr key={doc.id}>
                          <td><strong>Dr. {doc.name}</strong></td>
                          <td>{doc.email}</td>
                          <td><span className="specialty-badge">{doc.specialty || "General"}</span></td>
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
                          onClick={() => handleSelectPlan(p.id, p.name)}
                          disabled={isCurrent}
                          className={`plan-select-btn ${isCurrent ? "current-btn" : ""}`}
                        >
                          {isCurrent ? "Active Package" : "Activate Package"}
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
    </div>
  );
};

export default HospitalDashboard;
