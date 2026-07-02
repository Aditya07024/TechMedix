import React, { useState, useEffect } from "react";
import { adminAPI, analyticsAPI, supportAPI, subscriptionAPI } from "../../api/techmedixAPI";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";
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
  const [supportTickets, setSupportTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

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

  // Chart data state
  const [chartData, setChartData] = useState(null);
  const [chartsLoading, setChartsLoading] = useState(false);

  // Subscription state
  const [subPlans, setSubPlans] = useState([]);
  const [subDoctors, setSubDoctors] = useState([]);
  const [subHospitals, setSubHospitals] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: "", price: "", trial_duration_days: "90", duration_days: "30", features: "", plan_type: "individual", max_doctors: "1" });
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateDoctor, setActivateDoctor] = useState(null);
  const [activateForm, setActivateForm] = useState({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });
  const [showActivateHospitalModal, setShowActivateHospitalModal] = useState(false);
  const [activateHospital, setActivateHospital] = useState(null);
  const [activateHospitalForm, setActivateHospitalForm] = useState({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === "payouts") {
      loadPayoutData();
    } else if (activeTab === "tickets" || activeTab === "transfers") {
      loadSupportTickets();
    } else if (activeTab === "subscriptions") {
      loadSubscriptionData();
    }
  }, [activeTab]);

  const loadSubscriptionData = async () => {
    try {
      setSubLoading(true);
      const [plansRes, doctorsRes, hospitalsRes] = await Promise.allSettled([
        subscriptionAPI.adminGetPlans(),
        subscriptionAPI.adminGetDoctors(),
        subscriptionAPI.adminGetHospitals(),
      ]);
      if (plansRes.status === "fulfilled") {
        setSubPlans(plansRes.value.data?.data || []);
      }
      if (doctorsRes.status === "fulfilled") {
        setSubDoctors(doctorsRes.value.data?.data || []);
      }
      if (hospitalsRes.status === "fulfilled") {
        setSubHospitals(hospitalsRes.value.data?.data || []);
      }
    } catch (err) {
      console.error("Failed to load subscription data:", err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleCreateOrUpdatePlan = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: planForm.name,
        price: Number(planForm.price) || 0,
        trial_duration_days: Number(planForm.trial_duration_days) || 90,
        duration_days: Number(planForm.duration_days) || 30,
        features: planForm.features ? planForm.features.split(",").map(f => f.trim()).filter(Boolean) : [],
        plan_type: planForm.plan_type || "individual",
        max_doctors: Number(planForm.max_doctors) || 1,
      };
      if (editingPlan) {
        await subscriptionAPI.adminUpdatePlan(editingPlan.id, data);
        alert("Plan updated!");
      } else {
        await subscriptionAPI.adminCreatePlan(data);
        alert("Plan created!");
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      setPlanForm({ name: "", price: "", trial_duration_days: "90", duration_days: "30", features: "", plan_type: "individual", max_doctors: "1" });
      await loadSubscriptionData();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Delete this subscription plan?")) return;
    try {
      await subscriptionAPI.adminDeletePlan(planId);
      alert("Plan deleted.");
      await loadSubscriptionData();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    }
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      price: String(plan.price),
      trial_duration_days: String(plan.trial_duration_days),
      duration_days: String(plan.duration_days),
      features: Array.isArray(plan.features) ? plan.features.join(", ") : "",
      plan_type: plan.plan_type || "individual",
      max_doctors: String(plan.max_doctors || 1),
    });
    setShowPlanModal(true);
  };

  const handleActivateHospitalSubscription = async (e) => {
    e.preventDefault();
    if (!activateHospital) return;
    try {
      await subscriptionAPI.adminActivateHospitalSubscription({
        hospital_id: activateHospital.hospital_id,
        plan_id: activateHospitalForm.plan_id || null,
        duration_days: Number(activateHospitalForm.duration_days) || null,
        amount_paid: Number(activateHospitalForm.amount_paid) || 0,
        payment_notes: activateHospitalForm.payment_notes,
      });
      alert(`Subscription activated for ${activateHospital.hospital_name}!`);
      setShowActivateHospitalModal(false);
      setActivateHospital(null);
      setActivateHospitalForm({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });
      await loadSubscriptionData();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleActivateSubscription = async (e) => {
    e.preventDefault();
    if (!activateDoctor) return;
    try {
      await subscriptionAPI.adminActivateSubscription({
        doctor_id: activateDoctor.doctor_id,
        plan_id: activateForm.plan_id || null,
        duration_days: Number(activateForm.duration_days) || null,
        amount_paid: Number(activateForm.amount_paid) || 0,
        payment_notes: activateForm.payment_notes,
      });
      alert(`Subscription activated for Dr. ${activateDoctor.doctor_name}!`);
      setShowActivateModal(false);
      setActivateDoctor(null);
      setActivateForm({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });
      await loadSubscriptionData();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    }
  };

  const loadSupportTickets = async () => {
    try {
      setTicketsLoading(true);
      const response = await supportAPI.getTickets();
      setSupportTickets(response.data?.tickets || response.data?.data || []);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      setUpdatingTicketId(ticketId);
      await supportAPI.updateTicketStatus(ticketId, status);
      alert(`Ticket marked as ${status}`);
      loadSupportTickets();
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setChartsLoading(true);
      const [statsRes, paymentsRes, usersRes, branchesRes, chartsRes] =
        await Promise.allSettled([
          analyticsAPI.getSystemStats(),
          adminAPI.getPayments(50, 0),
          adminAPI.getUsers(null, 50, 0),
          adminAPI.getBranches(),
          analyticsAPI.getChartData(30),
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
      if (chartsRes.status === "fulfilled") {
        setChartData(chartsRes.value.data?.data || null);
      }
    } catch (err) {
      setError("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
      setChartsLoading(false);
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

  const handleDeleteFailedOrPendingPayments = async () => {
    if (!window.confirm("Are you sure you want to delete all failed and pending payments? This action cannot be undone.")) {
      return;
    }

    try {
      setPaymentsLoading(true);
      setError(null);
      const res = await adminAPI.deleteFailedOrPendingPayments();
      if (res.data?.success) {
        alert(res.data.message || "Successfully deleted failed or pending payments.");
        // Refresh the payments list
        const refreshed = await adminAPI.getPayments(50, 0);
        setPayments(refreshed.data?.data || []);
      } else {
        setError(res.data?.error || "Failed to delete payments.");
      }
    } catch (err) {
      console.error("Failed to delete failed or pending payments:", err);
      setError(err.response?.data?.error || err.message || "Failed to delete payments.");
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
      {/* <header className="admin-header">
        <h1>🏥 Admin Panel</h1>
        <p>System Management, Financial Payouts & Branch Control</p>
      </header> */}

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
          className={`tab-btn ${activeTab === "tickets" ? "active" : ""}`}
          onClick={() => setActiveTab("tickets")}
        >
          🎫 Support Tickets
        </button>
        <button
          className={`tab-btn ${activeTab === "transfers" ? "active" : ""}`}
          onClick={() => setActiveTab("transfers")}
        >
          🔄 Patient Transfers
        </button>
        <button
          className={`tab-btn ${activeTab === "subscriptions" ? "active" : ""}`}
          onClick={() => setActiveTab("subscriptions")}
        >
          📋 Subscriptions
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

            {/* ═══════ CHARTS SECTION ═══════ */}
            {chartsLoading && !chartData && (
              <p className="charts-loading">Loading analytics charts...</p>
            )}

            {chartData && (
              <div className="charts-section">

                {/* 1. Appointment Trends — Area Chart */}
                <div className="chart-card chart-card--wide">
                  <h3>📅 Appointment Trends <span className="chart-subtitle">Last 30 days</span></h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={(chartData.daily_appointments || []).map(d => ({
                      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                      Booked: d.booked,
                      Completed: d.completed,
                      Cancelled: d.cancelled
                    }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradBooked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00de94" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00de94" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCancelled" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      <Legend />
                      <Area type="monotone" dataKey="Booked" stroke="#6366f1" fillOpacity={1} fill="url(#gradBooked)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Completed" stroke="#00de94" fillOpacity={1} fill="url(#gradCompleted)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Cancelled" stroke="#f43f5e" fillOpacity={1} fill="url(#gradCancelled)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* 2. Revenue Trend — Area Chart */}
                <div className="chart-card chart-card--wide">
                  <h3>💰 Revenue Trend <span className="chart-subtitle">Last 30 days</span></h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={(chartData.daily_revenue || []).map(d => ({
                      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                      Online: d.online,
                      Offline: d.offline,
                      Total: d.total
                    }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradOnline" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradOffline" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                      <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      <Legend />
                      <Area type="monotone" dataKey="Online" stroke="#8b5cf6" fillOpacity={1} fill="url(#gradOnline)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Offline" stroke="#f59e0b" fillOpacity={1} fill="url(#gradOffline)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Total" stroke="#00de94" strokeWidth={2.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Row: Pie charts side by side */}
                <div className="charts-row">

                  {/* 3. Payment Methods — Pie Chart */}
                  <div className="chart-card">
                    <h3>💳 Payment Methods</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={(chartData.payment_methods || []).map(m => ({
                            name: m.method === 'online' ? 'Online' : m.method === 'cash' ? 'Cash' : m.method === 'wallet' ? 'Wallet' : m.method,
                            value: m.count
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(chartData.payment_methods || []).map((_, i) => (
                            <Cell key={i} fill={['#8b5cf6', '#00de94', '#f59e0b', '#f43f5e', '#3b82f6'][i % 5]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} payments`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 4. Appointment Status — Donut Chart */}
                  <div className="chart-card">
                    <h3>📊 Appointment Status</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={(chartData.appointment_statuses || []).map(s => ({
                            name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
                            value: s.count
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(chartData.appointment_statuses || []).map((_, i) => (
                            <Cell key={i} fill={['#00de94', '#6366f1', '#f43f5e', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} appointments`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. Top Doctors — Bar Chart */}
                <div className="chart-card chart-card--wide">
                  <h3>🏆 Top Doctors by Completed Appointments</h3>
                  <ResponsiveContainer width="100%" height={Math.max(280, (chartData.top_doctors || []).length * 42)}>
                    <BarChart
                      data={(chartData.top_doctors || []).map(d => ({
                        name: `Dr. ${d.doctor_name}`,
                        Completed: d.completed_count,
                        Revenue: d.total_revenue
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={140} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      <Legend />
                      <Bar dataKey="Completed" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 6. Top Doctors Revenue — Bar Chart */}
                <div className="chart-card chart-card--wide">
                  <h3>💸 Doctor-wise Revenue</h3>
                  <ResponsiveContainer width="100%" height={Math.max(280, (chartData.top_doctors || []).length * 42)}>
                    <BarChart
                      data={(chartData.top_doctors || []).map(d => ({
                        name: `Dr. ${d.doctor_name}`,
                        Revenue: d.total_revenue
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={140} />
                      <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      <Bar dataKey="Revenue" fill="#00de94" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 7. Monthly Patient Registrations — Line Chart */}
                <div className="chart-card chart-card--wide">
                  <h3>👥 Monthly Patient Registrations <span className="chart-subtitle">Last 12 months</span></h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(chartData.monthly_registrations || []).map(d => ({
                      month: new Date(d.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
                      Patients: d.patients
                    }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                      <Line type="monotone" dataKey="Patients" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: '#6366f1' }} activeDot={{ r: 7, fill: '#00de94' }} />
                    </LineChart>
                  </ResponsiveContainer>
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
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={handleDeleteFailedOrPendingPayments}
                  disabled={paymentsLoading}
                  className="delete-failed-btn"
                  title="Delete all failed or pending payments"
                >
                  🗑️ Delete Failed/Pending
                </button>
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
            </div>
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Payer</th>
                    <th>Base Amount</th>
                    <th>GST (2%)</th>
                    <th>Platform Fee (0.5%)</th>
                    <th>Total Paid</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan="9">No payments found</td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.id.substring(0, 8)}...</td>
                        <td>{payment.patient_name || (payment.doctor_name ? `Dr. ${payment.doctor_name} (Promo)` : "Anonymous")}</td>
                        <td>₹{Number(payment.amount).toFixed(2)}</td>
                        <td>₹{Number(payment.gst_charges || 0).toFixed(2)}</td>
                        <td>₹{Number(payment.platform_fees || 0).toFixed(2)}</td>
                        <td>₹{Number(payment.total_amount || payment.amount).toFixed(2)}</td>
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
            {/* <p>Distribute consultaion fees received online back to the practitioners.</p> */}
            
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

        {activeTab === "tickets" && (
          <div className="tab-content tickets-tab">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Support Tickets</h2>
              <button type="button" onClick={loadSupportTickets} disabled={ticketsLoading} className="refresh-btn">
                {ticketsLoading ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
            
            {ticketsLoading && supportTickets.filter(t => t.category !== 'withdrawal').length === 0 ? (
              <div className="loading-state">Loading support tickets...</div>
            ) : supportTickets.filter(t => t.category !== 'withdrawal').length === 0 ? (
              <div className="empty-state">No support tickets have been submitted yet.</div>
            ) : (
              <div className="tickets-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {supportTickets
                  .filter(t => t.category !== 'withdrawal')
                  .map((ticket) => (
                    <div key={ticket.id} className="ticket-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', background: '#edf2f7', padding: '4px 8px', borderRadius: '4px', marginRight: '10px', color: '#4a5568' }}>
                            {ticket.category?.toUpperCase() || 'GENERAL'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                            Ticket ID: {String(ticket.id).slice(0, 8)}...
                          </span>
                        </div>
                        <span className={`status-badge ${ticket.status}`} style={{ fontSize: '0.8rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px', background: ticket.status === 'open' ? '#feebc8' : '#e6fffa', color: ticket.status === 'open' ? '#c05621' : '#319795' }}>
                          {ticket.status?.toUpperCase()}
                        </span>
                      </div>
                      
                      <h3 style={{ margin: '5px 0 10px 0', fontSize: '1.1rem', color: '#2d3748' }}>{ticket.subject}</h3>
                      <p style={{ fontSize: '0.95rem', color: '#4a5568', margin: '0 0 15px 0', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#718096', borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
                        <div>
                          Submitted by: <strong>{ticket.patient_name || 'Patient'}</strong> ({ticket.patient_email || ticket.patient_id})
                          <br />
                          Date: {new Date(ticket.created_at).toLocaleString()}
                        </div>
                        
                        {ticket.status === 'open' && (
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                              disabled={updatingTicketId === ticket.id}
                              style={{ padding: '6px 12px', background: '#319795', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Mark as Resolved
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')}
                              disabled={updatingTicketId === ticket.id}
                              style={{ padding: '6px 12px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Close Ticket
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "transfers" && (
          <div className="tab-content transfers-tab">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Patient Wallet Transfers</h2>
              <button type="button" onClick={loadSupportTickets} disabled={ticketsLoading} className="refresh-btn">
                {ticketsLoading ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </div>

            <p style={{ marginBottom: '20px', color: '#4a5568' }}>
              Review and process wallet withdrawal requests submitted by patients. Approving a request marks the transfer as completed. Rejecting a request closes the request and automatically refunds the deducted amount back to the patient's wallet balance.
            </p>
            
            {ticketsLoading && supportTickets.filter(t => t.category === 'withdrawal').length === 0 ? (
              <div className="loading-state">Loading transfer requests...</div>
            ) : supportTickets.filter(t => t.category === 'withdrawal').length === 0 ? (
              <div className="empty-state">No patient transfer requests found.</div>
            ) : (
              <div className="transfers-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {supportTickets
                  .filter(t => t.category === 'withdrawal')
                  .map((ticket) => {
                    const desc = ticket.description || "";
                    const upiMatch = desc.match(/UPI ID:\s*([^\s\.]+)/i);
                    const upiId = upiMatch ? upiMatch[1] : "N/A";
                    
                    const amountMatch = desc.match(/transfer ₹([\d\.]+)/i);
                    const requestedAmount = amountMatch ? amountMatch[1] : "N/A";

                    return (
                      <div key={ticket.id} className="ticket-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', marginRight: '10px', color: '#4a5568' }}>
                              ₹{requestedAmount}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                              Request ID: {String(ticket.id).slice(0, 8)}...
                            </span>
                          </div>
                          <span className={`status-badge ${ticket.status}`} style={{ fontSize: '0.8rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px', background: ticket.status === 'open' ? '#feebc8' : ticket.status === 'resolved' ? '#e6fffa' : '#fed7d7', color: ticket.status === 'open' ? '#c05621' : ticket.status === 'resolved' ? '#319795' : '#c53030' }}>
                            {ticket.status === 'open' ? 'PENDING' : ticket.status === 'resolved' ? 'APPROVED (PAID)' : 'REJECTED (REFUNDED)'}
                          </span>
                        </div>
                        
                        <h3 style={{ margin: '5px 0 10px 0', fontSize: '1.1rem', color: '#2d3748' }}>
                          Withdrawal to UPI: <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px', fontSize: '0.95rem' }}>{upiId}</code>
                        </h3>
                        <p style={{ fontSize: '0.95rem', color: '#4a5568', margin: '0 0 15px 0', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#718096', borderTop: '1px solid #edf2f7', paddingTop: '15px' }}>
                          <div>
                            Patient: <strong>{ticket.patient_name || 'Patient'}</strong> ({ticket.patient_email || ticket.patient_id})
                            <br />
                            Date: {new Date(ticket.created_at).toLocaleString()}
                          </div>
                          
                          {ticket.status === 'open' && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved')}
                                disabled={updatingTicketId === ticket.id}
                                style={{ padding: '6px 12px', background: '#319795', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Approve & Pay UPI
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateTicketStatus(ticket.id, 'closed')}
                                disabled={updatingTicketId === ticket.id}
                                style={{ padding: '6px 12px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Reject & Refund
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="tab-content profile-tab">
            <h2>Admin Profile</h2>
            <ProfileManager title="Admin Profile" roleOverride="admin" />
          </div>
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === "subscriptions" && (
          <div className="tab-content subscriptions-tab">
            <div className="tab-header-row">
              <h2>Subscription Plans & Doctor Access</h2>
              <button onClick={loadSubscriptionData} disabled={subLoading} className={`refresh-btn ${subLoading ? "spinning" : ""}`}>
                <span>{subLoading ? "Refreshing..." : "🔄 Refresh"}</span>
              </button>
            </div>

            {/* ── PLANS SECTION ── */}
            <div className="sub-section">
              <div className="sub-section-header">
                <h3>📋 Subscription Plans</h3>
                <button className="record-payout-btn" onClick={() => { setEditingPlan(null); setPlanForm({ name: "", price: "", trial_duration_days: "90", duration_days: "30", features: "", plan_type: "individual", max_doctors: "1" }); setShowPlanModal(true); }}>
                  + Create Plan
                </button>
              </div>

              {subPlans.length === 0 ? (
                <p className="empty-state">No subscription plans created yet. Create one to get started.</p>
              ) : (
                <div className="sub-plans-grid">
                  {subPlans.map((plan) => (
                    <div key={plan.id} className={`sub-plan-card ${!plan.is_active ? "inactive" : ""}`}>
                      <div className="sub-plan-header">
                        <h4>{plan.name}</h4>
                        {!plan.is_active && <span className="sub-badge inactive">Inactive</span>}
                      </div>
                      <div className="sub-plan-price">
                        {Number(plan.price) === 0 ? (
                          <span className="free-label">Free</span>
                        ) : (
                          <><span className="price-amount">₹{Number(plan.price).toLocaleString("en-IN")}</span><span className="price-period">/ {plan.duration_days} days</span></>
                        )}
                      </div>
                      <div className="sub-plan-meta">
                        <span>Trial: {plan.trial_duration_days} days</span>
                        <span>Duration: {plan.duration_days} days</span>
                      </div>
                      <div className="sub-plan-meta">
                        <span>Type: {plan.plan_type === 'hospital' ? `🏢 Hospital (${plan.max_doctors} slots)` : '👤 Individual'}</span>
                      </div>
                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="sub-plan-features">
                          {plan.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                        </ul>
                      )}
                      <div className="sub-plan-actions">
                        <button className="sub-edit-btn" onClick={() => openEditPlan(plan)}>Edit</button>
                        <button className="sub-delete-btn" onClick={() => handleDeletePlan(plan.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── DOCTORS SECTION ── */}
            <div className="sub-section">
              <h3>👨‍⚕️ Doctor Subscription Status</h3>
              <div className="transactions-table">
                <table>
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>Specialty</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Trial Ends</th>
                      <th>Paid Until</th>
                      <th>Amount Paid</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subDoctors.length === 0 ? (
                      <tr><td colSpan="8">No doctors found</td></tr>
                    ) : (
                      subDoctors.map((doc) => {
                        const statusClass = doc.computed_status === "active" ? "status-active"
                          : doc.computed_status === "trial" ? "status-trial"
                          : doc.computed_status === "hospital_covered" ? "status-active"
                          : "status-expired";
                        const statusLabel = doc.computed_status === "trial" ? "🟢 Trial"
                          : doc.computed_status === "active" ? "🟢 Active"
                          : doc.computed_status === "hospital_covered" ? `🏢 Hospital (${doc.hospital_name || 'Covered'})`
                          : doc.computed_status === "trial_expired" ? "🔴 Trial Expired"
                          : doc.computed_status === "expired" ? "🔴 Expired"
                          : "⚪ None";
                        return (
                          <tr key={doc.doctor_id}>
                            <td><strong>Dr. {doc.doctor_name}</strong></td>
                            <td>{doc.specialty || "—"}</td>
                            <td><span className={`sub-status-badge ${statusClass}`}>{statusLabel}</span></td>
                            <td>{doc.plan_name || (doc.hospital_id ? "Hospital Package" : "—")}</td>
                            <td>{doc.trial_end_date && !doc.hospital_id ? new Date(doc.trial_end_date).toLocaleDateString() : "—"}</td>
                            <td>{doc.paid_end_date && !doc.hospital_id ? new Date(doc.paid_end_date).toLocaleDateString() : "—"}</td>
                            <td>{doc.amount_paid && !doc.hospital_id ? `₹${Number(doc.amount_paid).toLocaleString("en-IN")}` : "—"}</td>
                            <td>
                              {!doc.hospital_id && (
                                <button
                                  className="record-payout-btn"
                                  onClick={() => {
                                    setActivateDoctor(doc);
                                    setActivateForm({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });
                                    setShowActivateModal(true);
                                  }}
                                >
                                  Activate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── HOSPITALS SECTION ── */}
            <div className="sub-section mt-4">
              <h3>🏢 Hospital Subscription Status</h3>
              <div className="transactions-table">
                <table>
                  <thead>
                    <tr>
                      <th>Hospital</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Plan</th>
                      <th>Doctors Linked</th>
                      <th>Valid Until</th>
                      <th>Amount Paid</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subHospitals.length === 0 ? (
                      <tr><td colSpan="8">No hospitals found</td></tr>
                    ) : (
                      subHospitals.map((hosp) => {
                        const statusClass = hosp.computed_status === "active" ? "status-active" : "status-expired";
                        const statusLabel = hosp.computed_status === "active" ? "🟢 Active"
                          : hosp.computed_status === "expired" ? "🔴 Expired"
                          : "⚪ None";
                        return (
                          <tr key={hosp.hospital_id}>
                            <td><strong>{hosp.hospital_name}</strong></td>
                            <td>{hosp.hospital_email}</td>
                            <td><span className={`sub-status-badge ${statusClass}`}>{statusLabel}</span></td>
                            <td>{hosp.plan_name || "—"}</td>
                            <td>{hosp.linked_doctors_count || 0} / {hosp.max_doctors || 0}</td>
                            <td>{hosp.end_date ? new Date(hosp.end_date).toLocaleDateString() : "—"}</td>
                            <td>{hosp.amount_paid ? `₹${Number(hosp.amount_paid).toLocaleString("en-IN")}` : "—"}</td>
                            <td>
                              <button
                                className="record-payout-btn"
                                onClick={() => {
                                  setActivateHospital(hosp);
                                  setActivateHospitalForm({ plan_id: "", duration_days: "", amount_paid: "", payment_notes: "" });
                                  setShowActivateHospitalModal(true);
                                }}
                              >
                                Activate
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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

      {/* CREATE/EDIT PLAN MODAL */}
      {showPlanModal && (
        <div className="modal-overlay">
          <div className="payout-modal-content">
            <h3>{editingPlan ? "Edit Plan" : "Create Subscription Plan"}</h3>
            <form onSubmit={handleCreateOrUpdatePlan}>
              <div className="form-group">
                <label>Plan Name</label>
                <input type="text" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required placeholder="e.g. Professional" />
              </div>
              <div className="form-group">
                <label>Plan Type</label>
                <select value={planForm.plan_type} onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}>
                  <option value="individual">👤 Individual Plan</option>
                  <option value="hospital">🏢 Hospital Plan (slots based)</option>
                </select>
              </div>
              {planForm.plan_type === "hospital" && (
                <div className="form-group">
                  <label>Max Covered Doctors (slots)</label>
                  <input type="number" min="1" value={planForm.max_doctors} onChange={(e) => setPlanForm({ ...planForm, max_doctors: e.target.value })} placeholder="5" />
                </div>
              )}
              <div className="form-group">
                <label>Monthly Price (₹) — 0 for free</label>
                <input type="number" step="1" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Trial Duration (days)</label>
                <input type="number" min="0" value={planForm.trial_duration_days} onChange={(e) => setPlanForm({ ...planForm, trial_duration_days: e.target.value })} placeholder="90" />
              </div>
              <div className="form-group">
                <label>Paid Duration (days)</label>
                <input type="number" min="1" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })} placeholder="30" />
              </div>
              <div className="form-group">
                <label>Features (comma separated)</label>
                <input type="text" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="Unlimited patients, Priority support" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="modal-btn submit">{editingPlan ? "Update Plan" : "Create Plan"}</button>
                <button type="button" className="modal-btn cancel" onClick={() => { setShowPlanModal(false); setEditingPlan(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATE SUBSCRIPTION MODAL */}
      {showActivateModal && activateDoctor && (
        <div className="modal-overlay">
          <div className="payout-modal-content">
            <h3>Activate Subscription</h3>
            <p>Activate paid subscription for <strong>Dr. {activateDoctor.doctor_name}</strong></p>
            <form onSubmit={handleActivateSubscription}>
              <div className="form-group">
                <label>Select Plan</label>
                <select value={activateForm.plan_id} onChange={(e) => setActivateForm({ ...activateForm, plan_id: e.target.value })}>
                  <option value="">— No specific plan —</option>
                  {subPlans.filter(p => p.is_active && p.plan_type === "individual").map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString("en-IN")} / {p.duration_days}d</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Duration (days) — leave blank to use plan default</label>
                <input type="number" min="1" value={activateForm.duration_days} onChange={(e) => setActivateForm({ ...activateForm, duration_days: e.target.value })} placeholder="30" />
              </div>
              <div className="form-group">
                <label>Amount Paid (₹)</label>
                <input type="number" step="0.01" min="0" value={activateForm.amount_paid} onChange={(e) => setActivateForm({ ...activateForm, amount_paid: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Payment Notes</label>
                <textarea value={activateForm.payment_notes} onChange={(e) => setActivateForm({ ...activateForm, payment_notes: e.target.value })} placeholder="e.g. UPI txn ref, cheque number" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="modal-btn submit">Activate Subscription</button>
                <button type="button" className="modal-btn cancel" onClick={() => { setShowActivateModal(false); setActivateDoctor(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATE HOSPITAL SUBSCRIPTION MODAL */}
      {showActivateHospitalModal && activateHospital && (
        <div className="modal-overlay">
          <div className="payout-modal-content">
            <h3>Activate Hospital Subscription</h3>
            <p>Activate paid subscription package for <strong>{activateHospital.hospital_name}</strong></p>
            <form onSubmit={handleActivateHospitalSubscription}>
              <div className="form-group">
                <label>Select Plan</label>
                <select value={activateHospitalForm.plan_id} onChange={(e) => setActivateHospitalForm({ ...activateHospitalForm, plan_id: e.target.value })}>
                  <option value="">— No specific plan —</option>
                  {subPlans.filter(p => p.is_active && p.plan_type === "hospital").map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.max_doctors} slots) — ₹{Number(p.price).toLocaleString("en-IN")} / {p.duration_days}d</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Duration (days) — leave blank to use plan default</label>
                <input type="number" min="1" value={activateHospitalForm.duration_days} onChange={(e) => setActivateHospitalForm({ ...activateHospitalForm, duration_days: e.target.value })} placeholder="30" />
              </div>
              <div className="form-group">
                <label>Amount Paid (₹)</label>
                <input type="number" step="0.01" min="0" value={activateHospitalForm.amount_paid} onChange={(e) => setActivateHospitalForm({ ...activateHospitalForm, amount_paid: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Payment Notes</label>
                <textarea value={activateHospitalForm.payment_notes} onChange={(e) => setActivateHospitalForm({ ...activateHospitalForm, payment_notes: e.target.value })} placeholder="e.g. UPI txn ref, cheque number" />
              </div>
              <div className="modal-actions">
                <button type="submit" className="modal-btn submit">Activate Subscription</button>
                <button type="button" className="modal-btn cancel" onClick={() => { setShowActivateHospitalModal(false); setActivateHospital(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
