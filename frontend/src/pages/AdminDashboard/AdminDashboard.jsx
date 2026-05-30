import React, { useState, useEffect } from "react";
import { adminAPI, analyticsAPI } from "../../api/techmedixAPI";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import "./AdminDashboard.css";

/**
 * ADMIN DASHBOARD
 * System analytics, user management, payments, doctor payouts, branch control
 */
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [systemStats, setSystemStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // User filtering state
  const [selectedRole, setSelectedRole] = useState("");

  // Payout tracking state
  const [payoutSummary, setPayoutSummary] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === "payouts") {
      loadPayoutData();
    }
  }, [activeTab]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, paymentsRes, usersRes, branchesRes] =
        await Promise.allSettled([
          analyticsAPI.getSystemStats(),
          adminAPI.getPayments(50, 0),
          adminAPI.getUsers(null, 50, 0),
          adminAPI.getBranches(),
        ]);

      if (statsRes.status === "fulfilled") {
        setSystemStats(statsRes.value.data?.data || {});
      }
      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data?.data || []);
      }
      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.data?.data || []);
      }
      if (branchesRes.status === "fulfilled") {
        setBranches(branchesRes.value.data?.data || []);
      }
    } catch (err) {
      setError("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshPayments = async () => {
    try {
      setPaymentsLoading(true);
      setError(null);
      const res = await adminAPI.getPayments(50, 0);
      setPayments(res.data?.data || []);
    } catch (err) {
      console.error("Payments refresh error:", err);
      setError("Failed to refresh payments: " + err.message);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPayoutData = async () => {
    try {
      setPayoutLoading(true);
      setError(null);
      const [summaryRes, historyRes] = await Promise.allSettled([
        adminAPI.getPayoutSummary(),
        adminAPI.getPayoutHistory(),
      ]);

      if (summaryRes.status === "fulfilled" && summaryRes.value.data?.success) {
        setPayoutSummary(summaryRes.value.data.data || []);
      }
      if (historyRes.status === "fulfilled" && historyRes.value.data?.success) {
        setPayoutHistory(historyRes.value.data.data || []);
      }
    } catch (err) {
      console.error("Payout load error:", err);
      setError("Failed to load payout data.");
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleRoleChange = async (role) => {
    setSelectedRole(role);
    try {
      setLoading(true);
      setError(null);
      const res = await adminAPI.getUsers(role || null, 100, 0);
      if (res.data?.success || Array.isArray(res.data?.data)) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      setError("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openPayoutModal = (doctor) => {
    setSelectedDoctor(doctor);
    setPayoutAmount(String(doctor.pending_payout));
    setPayoutNotes("");
    setShowPayoutModal(true);
  };

  const handleRecordPayout = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !payoutAmount) return;

    try {
      setError(null);
      const res = await adminAPI.createPayout({
        doctor_id: selectedDoctor.doctor_id,
        amount: parseFloat(payoutAmount),
        reference_notes: payoutNotes,
      });

      if (res.data?.success) {
        alert("Payout recorded successfully!");
        setShowPayoutModal(false);
        setSelectedDoctor(null);
        setPayoutAmount("");
        setPayoutNotes("");
        await loadPayoutData();
      } else {
        setError(res.data?.error || "Failed to create payout.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to record payout.");
    }
  };

  if (loading && activeTab !== "payouts" && activeTab !== "users")
    return (
      <div className="admin-dashboard">
        <p>Loading TechMedix clinical control panel...</p>
      </div>
    );

  const filterRoles = [
    { id: "", label: "All Users" },
    { id: "patient", label: "Patients" },
    { id: "doctor", label: "Doctors" },
    { id: "staff", label: "Staff" },
    { id: "admin", label: "Admins" },
  ];

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>🏥 TechMedix Admin Panel</h1>
        <p>System Management, Financial Payouts & Branch Control</p>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📊 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          💳 Payments
        </button>
        <button
          className={`tab-btn ${activeTab === "payouts" ? "active" : ""}`}
          onClick={() => setActiveTab("payouts")}
        >
          💸 Doctor Payouts
        </button>
        <button
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👥 Users
        </button>
        <button
          className={`tab-btn ${activeTab === "branches" ? "active" : ""}`}
          onClick={() => setActiveTab("branches")}
        >
          🏢 Branches
        </button>
        <button
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          👤 Profile
        </button>
      </div>

      <div className="admin-content">
        {error && <div className="error-message">{error}</div>}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="tab-content overview-tab">
            <h2>System Overview</h2>
            {systemStats && (
              <div className="stats-grid">
                <div className="stat-card">
                  <h4>👥 Total Patients</h4>
                  <p className="big-number">
                    {systemStats.total_patients || 0}
                  </p>
                  <small>Registered users</small>
                </div>
                <div className="stat-card">
                  <h4>👨‍⚕️ Total Doctors</h4>
                  <p className="big-number">{systemStats.total_doctors || 0}</p>
                  <small>Active practitioners</small>
                </div>
                <div className="stat-card">
                  <h4>📅 Total Appointments</h4>
                  <p className="big-number">
                    {systemStats.total_appointments || 0}
                  </p>
                  <small>All time</small>
                </div>
                <div className="stat-card">
                  <h4>💰 Total Revenue</h4>
                  <p className="big-number">
                    ₹{Number(systemStats.total_revenue || 0).toLocaleString("en-IN")}
                  </p>
                  <small>Platform revenue</small>
                </div>
                <div className="stat-card">
                  <h4>💳 Online Revenue</h4>
                  <p className="big-number">
                    ₹{Number(systemStats.online_revenue || 0).toLocaleString("en-IN")}
                  </p>
                  <small>Razorpay & Wallet</small>
                </div>
                <div className="stat-card">
                  <h4>💵 Offline Revenue</h4>
                  <p className="big-number">
                    ₹{Number(systemStats.offline_revenue || 0).toLocaleString("en-IN")}
                  </p>
                  <small>Collected in Cash</small>
                </div>
                <div className="stat-card">
                  <h4>📅 Bookings Today</h4>
                  <p className="big-number">
                    {systemStats.bookings_today || 0}
                  </p>
                  <small>New slots booked</small>
                </div>
                <div className="stat-card">
                  <h4>📈 Bookings This Month</h4>
                  <p className="big-number">
                    {systemStats.bookings_this_month || 0}
                  </p>
                  <small>Monthly volume</small>
                </div>
                <div className="stat-card">
                  <h4>📊 Conversion Rate</h4>
                  <p className="big-number">
                    {systemStats.conversion_rate || 0}%
                  </p>
                  <small>Booked → Completed</small>
                </div>
                <div className="stat-card">
                  <h4>⭐ Avg Rating</h4>
                  <p className="big-number">{systemStats.avg_rating || 0}/5</p>
                  <small>Doctor ratings</small>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && (
          <div className="tab-content payments-tab">
            <div className="tab-header-row">
              <h2>Payment Transactions</h2>
              <button
                onClick={refreshPayments}
                disabled={paymentsLoading}
                className={`refresh-btn ${paymentsLoading ? "spinning" : ""}`}
                title="Refresh payments"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="refresh-icon"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
                <span>{paymentsLoading ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Patient</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan="6">No payments found</td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.id.substring(0, 8)}...</td>
                        <td>{payment.patient_name || "Anonymous"}</td>
                        <td>₹{payment.amount}</td>
                        <td>
                          <span className={`status ${payment.status}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td>
                          {new Date(payment.created_at).toLocaleDateString()}
                        </td>
                        <td>{payment.payment_method}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DOCTOR PAYOUTS TAB */}
        {activeTab === "payouts" && (
          <div className="tab-content payouts-tab">
            <div className="tab-header-row">
              <h2>Doctor Earnings & Payouts</h2>
              <button
                onClick={loadPayoutData}
                disabled={payoutLoading}
                className={`refresh-btn ${payoutLoading ? "spinning" : ""}`}
                title="Refresh payouts"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="refresh-icon"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
                <span>{payoutLoading ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
            <p>Distribute consultaion fees received online (Razorpay) back to the practitioners.</p>
            
            {payoutLoading && payoutSummary.length === 0 ? (
              <p>Loading payouts metrics...</p>
            ) : (
              <div className="payouts-view">
                <h3>Practitioner Balances</h3>
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor Name</th>
                        <th>Specialty</th>
                        <th>Collected Online</th>
                        <th>Collected Offline (Cash)</th>
                        <th>Total Paid Out</th>
                        <th>Pending Payout</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutSummary.length === 0 ? (
                        <tr>
                          <td colSpan="7">No doctor records found</td>
                        </tr>
                      ) : (
                        payoutSummary.map((doc) => (
                          <tr key={doc.doctor_id}>
                            <td><strong>Dr. {doc.doctor_name}</strong></td>
                            <td>{doc.specialty}</td>
                            <td>₹{(doc.online_collected || 0).toFixed(2)}</td>
                            <td>₹{(doc.offline_collected || 0).toFixed(2)}</td>
                            <td>₹{doc.total_paid_out.toFixed(2)}</td>
                            <td className={doc.pending_payout > 0 ? "highlight-payout" : ""}>
                              <strong>₹{doc.pending_payout.toFixed(2)}</strong>
                            </td>
                            <td>
                              <button
                                className="record-payout-btn"
                                onClick={() => openPayoutModal(doc)}
                                disabled={doc.pending_payout <= 0}
                              >
                                Distribute
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="history-heading">Distribution History</h3>
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Notes / References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.length === 0 ? (
                        <tr>
                          <td colSpan="4">No payout distributions recorded yet</td>
                        </tr>
                      ) : (
                        payoutHistory.map((payout) => (
                          <tr key={payout.id}>
                            <td>Dr. {payout.doctor_name}</td>
                            <td><strong>₹{Number(payout.amount).toFixed(2)}</strong></td>
                            <td>{new Date(payout.payout_date).toLocaleDateString()}</td>
                            <td>{payout.reference_notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="tab-content users-tab">
            <h2>Users</h2>
            <div className="users-filters">
              {filterRoles.map((role) => (
                <button
                  key={role.id}
                  className={`filter-btn ${selectedRole === role.id ? "active" : ""}`}
                  onClick={() => handleRoleChange(role.id)}
                >
                  {role.label}
                </button>
              ))}
            </div>
            <div className="users-grid">
              {users.length === 0 ? (
                <p>No users found</p>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="user-card">
                    <h4>{user.name}</h4>
                    <p className="role">👤 {user.role}</p>
                    <p className="email">✉️ {user.email}</p>
                    <p className="phone">📱 {user.phone || "N/A"}</p>
                    <p className="date">
                      📅 Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* BRANCHES TAB */}
        {activeTab === "branches" && (
          <div className="tab-content branches-tab">
            <h2>Branches</h2>
            <div className="branches-grid">
              {branches.length === 0 ? (
                <p>No branches found</p>
              ) : (
                branches.map((branch) => (
                  <div key={branch.id} className="branch-card">
                    <h4>🏢 {branch.name}</h4>
                    <p className="location">📍 {branch.address || "N/A"}</p>
                    <p className="city">
                      {branch.city}, {branch.state}
                    </p>
                    <p className="phone">☎️ {branch.phone || "N/A"}</p>
                    <div className="branch-stats">
                      <span>
                        Doctors: <strong>{branch.doctor_count || 0}</strong>
                      </span>
                      <span>
                        Patients: <strong>{branch.patient_count || 0}</strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="tab-content profile-tab">
            <h2>Admin Profile</h2>
            <ProfileManager title="Admin Profile" roleOverride="admin" />
          </div>
        )}
      </div>

      {/* RECORD PAYOUT MODAL */}
      {showPayoutModal && selectedDoctor && (
        <div className="modal-overlay">
          <div className="payout-modal-content">
            <h3>Record Doctor Payout</h3>
            <p>Confirm the distribution of collected consultation fees to <strong>Dr. {selectedDoctor.doctor_name}</strong>.</p>
            <form onSubmit={handleRecordPayout}>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedDoctor.pending_payout}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                />
                <small className="help-text">Max allowed: ₹{selectedDoctor.pending_payout.toFixed(2)}</small>
              </div>
              <div className="form-group">
                <label>Notes / Transaction Reference</label>
                <textarea
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Bank IMPS Ref ID or cheque number"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="modal-btn submit">Record Payout</button>
                <button
                  type="button"
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowPayoutModal(false);
                    setSelectedDoctor(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
