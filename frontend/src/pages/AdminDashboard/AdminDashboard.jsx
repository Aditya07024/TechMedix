import React, { useState, useEffect } from "react";
import { adminAPI, analyticsAPI } from "../../api/techmedixAPI";
import "./AdminDashboard.css";

/**
 * ADMIN DASHBOARD
 * System analytics, user management, payments, branch control
 */
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [systemStats, setSystemStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAdminData();
  }, []);

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
        setSystemStats(statsRes.value.data.data || {});
      }
      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data.data || []);
      }
      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.data.data || []);
      }
      if (branchesRes.status === "fulfilled") {
        setBranches(branchesRes.value.data.data || []);
      }
    } catch (err) {
      setError("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="admin-dashboard">
        <p>Loading...</p>
      </div>
    );

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>🏥 TechMedix Admin Panel</h1>
        <p>System Management & Analytics</p>
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
                    ₹{systemStats.total_revenue || 0}
                  </p>
                  <small>Platform revenue</small>
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
            <h2>Payment Transactions</h2>
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
                        <td>{payment.patient_name}</td>
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

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="tab-content users-tab">
            <h2>Users</h2>
            <div className="users-filters">
              <button className="filter-btn active">All Users</button>
              <button className="filter-btn">Patients</button>
              <button className="filter-btn">Doctors</button>
              <button className="filter-btn">Admins</button>
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
                    <p className="location">📍 {branch.location}</p>
                    <p className="city">
                      {branch.city}, {branch.state}
                    </p>
                    <p className="phone">☎️ {branch.phone}</p>
                    <p className="email">✉️ {branch.email}</p>
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
      </div>
    </div>
  );
}
