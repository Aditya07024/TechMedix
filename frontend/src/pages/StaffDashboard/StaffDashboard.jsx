import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  BellRing,
  ClipboardPlus,
  Clock3,
  FileUp,
  RefreshCcw,
  TimerReset,
  UserRoundPen,
  Users,
} from "lucide-react";
import { paymentApi, staffApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { subscribeToQueue } from "../../api/socketService";
import ProfileManager from "../../components/ProfileManager/ProfileManager";
import { formatDateTime12Hour, formatTime12Hour } from "../../utils/dateTime";
import "./StaffDashboard.css";

const QUEUE_STATUS_OPTIONS = ["waiting", "in-progress", "completed"];

function getPaymentMeta(appointment) {
  const status = String(appointment?.payment_status || "").toLowerCase();
  const method = String(appointment?.payment_method || "").toLowerCase();

  if (status === "paid") {
    if (method === "online") {
      return { label: "Paid Online", className: "payment-paid-online" };
    }
    if (method === "cash") {
      return { label: "Paid Cash", className: "payment-paid-cash" };
    }
    if (method === "wallet") {
      return { label: "Paid Wallet", className: "payment-paid-wallet" };
    }
    return { label: "Paid", className: "payment-paid" };
  }

  if (status === "due" && method === "cash") {
    return { label: "Cash Due", className: "payment-due" };
  }

  if (status === "pending" && method === "online") {
    return { label: "Online Pending", className: "payment-pending" };
  }

  if (status === "pending" && method === "wallet") {
    return { label: "Wallet Pending", className: "payment-pending" };
  }

  return { label: "Need to Pay", className: "payment-unpaid" };
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="staff-stat-card">
      <div className="staff-stat-icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </article>
  );
}

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [queuesByDoctor, setQueuesByDoctor] = useState({});
  const [logs, setLogs] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [assignedDoctors, setAssignedDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [requestDoctorId, setRequestDoctorId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patient, setPatient] = useState(null);
  const [patientReports, setPatientReports] = useState([]);
  const [patientForm, setPatientForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "",
    blood_group: "",
    medical_history: "",
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyMap, setBusyMap] = useState({});
  const inFlightActionsRef = useRef(new Set());

  useEffect(() => {
    if (!statusMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  const visibleDoctors = selectedDoctorId
    ? assignedDoctors.filter((doctor) => doctor.id === selectedDoctorId)
    : assignedDoctors;
  const visibleAppointments = selectedDoctorId
    ? appointments.filter((appointment) => appointment.doctor_id === selectedDoctorId)
    : appointments;

  async function loadQueues(doctors) {
    const queueResponses = await Promise.all(
      doctors.map(async (doctor) => {
        try {
          const response = await staffApi.getLiveQueue(doctor.id);
          return [doctor.id, response.data?.data || []];
        } catch {
          return [doctor.id, []];
        }
      }),
    );

    setQueuesByDoctor(Object.fromEntries(queueResponses));
  }

  async function loadDashboard(doctorId = selectedDoctorId) {
    try {
      setLoading(true);
      const doctorsRes = await staffApi.getDoctors();
      const doctors = doctorsRes.data?.data || [];
      const assignedDoctorIds = new Set(doctors.map((entry) => entry.id));
      const requestedDoctorId = doctorId && assignedDoctorIds.has(doctorId) ? doctorId : "";
      const resolvedDoctorId = requestedDoctorId || "";

      const [overviewRes, appointmentsRes, logsRes, performanceRes] = await Promise.allSettled([
        staffApi.getOverview(),
        staffApi.getTodayAppointments(),
        staffApi.getActivity(),
        staffApi.getPerformance(),
      ]);
      const appointmentRows =
        appointmentsRes.status === "fulfilled"
          ? appointmentsRes.value.data?.data || []
          : [];

      setAssignedDoctors(doctors);
      setOverview(
        overviewRes.status === "fulfilled" ? overviewRes.value.data?.data || null : null,
      );
      setAppointments(appointmentRows);
      setLogs(logsRes.status === "fulfilled" ? logsRes.value.data?.data || [] : []);
      setPerformance(
        performanceRes.status === "fulfilled"
          ? performanceRes.value.data?.data || []
          : [],
      );
      setSelectedDoctorId(resolvedDoctorId);
      setSelectedPatientId((currentPatientId) => {
        if (!appointmentRows.length) {
          return "";
        }

        const stillVisible = appointmentRows.some(
          (entry) => entry.patient_id === currentPatientId,
        );
        return stillVisible ? currentPatientId : appointmentRows[0].patient_id;
      });
      await loadQueues(doctors);

      const firstError = [overviewRes, appointmentsRes, logsRes, performanceRes]
        .find((result) => result.status === "rejected");
      if (firstError) {
        setStatusMessage(
          firstError.reason?.response?.data?.error ||
            firstError.reason?.message ||
            "Some dashboard data could not be loaded.",
        );
      }
    } catch (err) {
      setStatusMessage(err.response?.data?.error || err.message || "Failed to load staff dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadPatient(patientId) {
    if (!patientId) {
      setPatient(null);
      setPatientReports([]);
      return;
    }

    try {
      const [patientRes, reportsRes] = await Promise.all([
        staffApi.getPatient(patientId),
        staffApi.getPatientReports(patientId),
      ]);

      const patientData = patientRes.data?.data || null;
      setPatient(patientData);
      setPatientReports(reportsRes.data?.data || []);
      setPatientForm({
        name: patientData?.name || "",
        phone: patientData?.phone || "",
        age: patientData?.age || "",
        gender: patientData?.gender || "",
        blood_group: patientData?.blood_group || "",
        medical_history: patientData?.medical_history || "",
      });
    } catch (err) {
      setStatusMessage(err.response?.data?.error || err.message || "Failed to load patient");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (assignedDoctors.length === 0) return undefined;

    const unsubscribers = assignedDoctors.map((doctor) =>
      subscribeToQueue(doctor.id, async () => {
        try {
          const queueRes = await staffApi.getLiveQueue(doctor.id);
          setQueuesByDoctor((prev) => ({
            ...prev,
            [doctor.id]: queueRes.data?.data || [],
          }));
        } catch {}
      }),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      });
    };
  }, [assignedDoctors]);

  useEffect(() => {
    if (selectedPatientId) {
      loadPatient(selectedPatientId);
    }
  }, [selectedPatientId]);

  const withBusy = async (key, fn) => {
    if (inFlightActionsRef.current.has(key)) {
      return;
    }

    inFlightActionsRef.current.add(key);
    setBusyMap((prev) => ({ ...prev, [key]: true }));
    setStatusMessage("");
    try {
      await fn();
    } catch (err) {
      setStatusMessage(
        err.response?.status === 429
          ? "Too many requests. Wait a moment before trying again."
          : err.response?.data?.error || err.message || "Action failed",
      );
    } finally {
      inFlightActionsRef.current.delete(key);
      setBusyMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleMarkArrived = (appointmentId, patientId, doctorId) =>
    withBusy(`arrive-${appointmentId}`, async () => {
      await staffApi.markArrived(appointmentId);
      await staffApi.generateToken(appointmentId, doctorId);
      setSelectedPatientId(patientId);
      setStatusMessage("Appointment checked in and added to the live queue.");
      await loadDashboard(selectedDoctorId);
    });

  const handleQueueStatusUpdate = (queueId, status) =>
    withBusy(`queue-${queueId}-${status}`, async () => {
      await staffApi.updateQueueStatus(queueId, status);
      setStatusMessage(`Queue status updated to ${status}.`);
      await loadDashboard(selectedDoctorId);
    });

  const handlePatientSave = (event) => {
    event.preventDefault();
    if (!selectedPatientId) return;

    return withBusy("patient-save", async () => {
      await staffApi.updatePatient(selectedPatientId, {
        ...patientForm,
        age: patientForm.age === "" ? null : Number(patientForm.age),
      });
      setStatusMessage("Patient details updated.");
      await loadPatient(selectedPatientId);
      await loadDashboard(selectedDoctorId);
    });
  };

  const handleUploadReport = () => {
    if (!selectedPatientId || !uploadFile) return;

    return withBusy("report-upload", async () => {
      const relatedAppointment = appointments.find(
        (entry) => entry.patient_id === selectedPatientId,
      );

      const formData = new FormData();
      formData.append("report", uploadFile);
      formData.append("patient_id", selectedPatientId);
      if (relatedAppointment?.id) {
        formData.append("appointment_id", relatedAppointment.id);
      }

      await staffApi.uploadReport(formData);
      setUploadFile(null);
      setStatusMessage("Report uploaded.");
      await loadPatient(selectedPatientId);
      await loadDashboard(selectedDoctorId);
    });
  };

  const handleNotifyDoctor = (appointment) =>
    withBusy(`notify-${appointment.id}`, async () => {
      await staffApi.notifyDoctor({
        doctor_id: appointment.doctor_id,
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        message: `${appointment.patient_name} is ready in the queue.`,
      });
      setStatusMessage("Doctor notified.");
    });

  const handleMarkCashPaid = (paymentId) =>
    withBusy(`cash-${paymentId}`, async () => {
      await paymentApi.markCashPaid({ payment_id: paymentId });
      setStatusMessage("Cash payment marked received.");
      await loadDashboard(selectedDoctorId);
    });

  const handleSwitchDoctor = (doctorId) => {
    const nextDoctorId = selectedDoctorId === doctorId ? "" : doctorId;
    setSelectedDoctorId(nextDoctorId);
    setStatusMessage(
      nextDoctorId
        ? "Dashboard filtered to one doctor."
        : "Showing all assigned doctors.",
    );
  };

  const handleDoctorRequest = () =>
    withBusy("request-doctor", async () => {
      await staffApi.requestDoctorAccess(requestDoctorId);
      setRequestDoctorId("");
      setStatusMessage("Doctor access request sent.");
      await loadDashboard(selectedDoctorId);
    });

  return (
    <div className="staff-dashboard-page">
      <header className="staff-dashboard-hero">
        <div>
          <span className="staff-dashboard-kicker">TechMedix Staff Dashboard</span>
          <h1>Front-desk flow with live queue control.</h1>
          <p>
            Welcome, {user?.name || "Staff"}. Manage arrivals, reports,
            and doctor handoff from a single workspace.
          </p>
        </div>

        <div className="staff-dashboard-actions">
          <button type="button" onClick={() => loadDashboard(selectedDoctorId)}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={logout}>
            <TimerReset size={16} />
            Logout
          </button>
        </div>
      </header>

      {statusMessage && (
        <div className="staff-status-banner">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage("")}>
            Close
          </button>
        </div>
      )}

      <section className="staff-stats-grid">
        <StatCard
          icon={Users}
          label="Today's Patients"
          value={overview?.total_patients ?? 0}
          helper="Scheduled across the branch"
        />
        <StatCard
          icon={Clock3}
          label="Waiting Count"
          value={overview?.waiting_count ?? 0}
          helper="Patients currently queued"
        />
        <StatCard
          icon={Activity}
          label="Avg Wait Time"
          value={`${overview?.avg_wait_minutes ?? 0} min`}
          helper="Average check-in to call time"
        />
        <StatCard
          icon={BellRing}
          label="Actions Today"
          value={overview?.staff_actions_today ?? 0}
          helper="Logged staff activity"
        />
      </section>

      <section className="staff-dashboard-grid">
        <article className="staff-panel">
          <ProfileManager title="Staff Profile" roleOverride="staff" />
        </article>
      </section>

      <section className="staff-dashboard-grid">
        <article className="staff-panel">
          <div className="staff-panel-header">
            <div>
              <h2>My Doctors</h2>
              <p>One staff member can manage all assigned doctors from one dashboard.</p>
            </div>
          </div>

          <div className="staff-queue-list">
            {assignedDoctors.map((doctor) => (
              <div key={doctor.id} className="staff-queue-card">
                <div>
                  <strong>{doctor.name}</strong>
                  <p>{doctor.specialty || "General Practice"}</p>
                  <span>{doctor.assignment_role || "assistant"}</span>
                </div>
                <div className="staff-status-actions">
                  <span
                    className={
                      selectedDoctorId === doctor.id
                        ? "staff-context-indicator is-active"
                        : "staff-context-indicator"
                    }
                  >
                    {selectedDoctorId === doctor.id ? "Filtered View" : "Visible in All View"}
                  </span>
                  <button
                    type="button"
                    className={
                      selectedDoctorId === doctor.id
                        ? "staff-context-button is-active"
                        : "staff-context-button"
                    }
                    onClick={() => handleSwitchDoctor(doctor.id)}
                  >
                    {selectedDoctorId === doctor.id ? "Show All Doctors" : "Focus This Doctor"}
                  </button>
                </div>
              </div>
            ))}
            {assignedDoctors.length === 0 && (
              <div className="staff-empty-state">No doctor assignments yet.</div>
            )}
          </div>

          <div className="staff-report-panel">
            <div className="staff-panel-header">
              <div>
                <h2>Request Doctor Access</h2>
                <p>Enter a doctor UUID to request access to another doctor.</p>
              </div>
            </div>
            <div className="staff-report-upload">
              <input
                type="text"
                placeholder="Doctor UUID"
                value={requestDoctorId}
                onChange={(event) => setRequestDoctorId(event.target.value)}
              />
              <button
                type="button"
                onClick={handleDoctorRequest}
                disabled={!requestDoctorId || busyMap["request-doctor"]}
              >
                Request Access
              </button>
            </div>
          </div>
        </article>

        <article className="staff-panel">
          <div className="staff-panel-header">
            <div>
              <h2>Appointments</h2>
              <p>Check in patients and notify the doctor.</p>
            </div>

            <select
              value={selectedDoctorId}
              onChange={(event) => {
                const nextDoctorId = event.target.value;
                setSelectedDoctorId(nextDoctorId);
                loadDashboard(nextDoctorId);
              }}
            >
              <option value="">All doctors</option>
              {assignedDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="staff-empty-state">Loading appointments...</div>
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Slot</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        <button
                          type="button"
                          className="staff-link-button"
                          onClick={() => setSelectedPatientId(appointment.patient_id)}
                        >
                          {appointment.patient_name}
                        </button>
                      </td>
                      <td>{appointment.doctor_name}</td>
                      <td>{formatTime12Hour(appointment.slot_time)}</td>
                      <td>
                        <span className={`staff-pill status-${appointment.status}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const paymentMeta = getPaymentMeta(appointment);
                          return (
                            <div className="staff-payment-cell">
                              <span className={`staff-pill ${paymentMeta.className}`}>
                                {paymentMeta.label}
                              </span>
                              {appointment.payment_amount ? (
                                <span className="staff-muted">
                                  Rs. {Number(appointment.payment_amount).toLocaleString("en-IN")}
                                </span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="staff-row-actions">
                        {appointment.payment_method === "cash" &&
                        appointment.payment_status === "due" &&
                        appointment.payment_id ? (
                          <button
                            type="button"
                            onClick={() => handleMarkCashPaid(appointment.payment_id)}
                            disabled={busyMap[`cash-${appointment.payment_id}`]}
                          >
                            Mark Paid
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            handleMarkArrived(
                              appointment.id,
                              appointment.patient_id,
                              appointment.doctor_id,
                            )
                          }
                          disabled={busyMap[`arrive-${appointment.id}`]}
                        >
                          Check In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNotifyDoctor(appointment)}
                          disabled={busyMap[`notify-${appointment.id}`]}
                        >
                          Notify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="staff-panel">
          <div className="staff-panel-header">
            <div>
              <h2>Live Queue</h2>
              <p>Real-time queue state across assigned doctors.</p>
            </div>
          </div>

          {visibleDoctors.length === 0 ? (
            <div className="staff-empty-state">No doctor assignments yet.</div>
          ) : (
            <div className="staff-live-queue-grid">
              {visibleDoctors.map((doctor) => {
                const doctorQueue = queuesByDoctor[doctor.id] || [];

                return (
                  <div key={doctor.id} className="staff-panel staff-live-queue-panel">
                    <div className="staff-panel-header">
                      <div>
                        <h3>{doctor.name}</h3>
                        <p>{doctor.specialty || "General Practice"}</p>
                      </div>
                      <span className="staff-context-indicator">
                        {doctorQueue.length} in queue
                      </span>
                    </div>

                    {doctorQueue.length === 0 ? (
                      <div className="staff-empty-state">No queue entries for this doctor.</div>
                    ) : (
                      <div className="staff-queue-list">
                        {doctorQueue.map((entry) => (
                          <div key={entry.id} className="staff-queue-card">
                            <div>
                              <strong>Token {entry.token_no}</strong>
                              <p>{entry.patient_name}</p>
                              <span>{entry.status}</span>
                            </div>

                            <div className="staff-status-actions">
                              {QUEUE_STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className={status === entry.status ? "active" : ""}
                                  onClick={() => handleQueueStatusUpdate(entry.id, status)}
                                  disabled={busyMap[`queue-${entry.id}-${status}`]}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="staff-panel">
          <div className="staff-panel-header">
            <div>
              <h2>Patient Detail</h2>
              <p>Editable non-clinical profile and report access.</p>
            </div>
          </div>

          {!patient ? (
            <div className="staff-empty-state">Select a patient from appointments.</div>
          ) : (
            <>
              <div className="staff-patient-summary">
                <h3>{patient.name}</h3>
                <p>{patient.email}</p>
                <span>Last appointment: {patient.last_appointment_date || "N/A"}</span>
              </div>

              <form className="staff-patient-form" onSubmit={handlePatientSave}>
                <label>
                  Name
                  <input
                    value={patientForm.name}
                    onChange={(event) =>
                      setPatientForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={patientForm.phone}
                    onChange={(event) =>
                      setPatientForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Age
                  <input
                    type="number"
                    value={patientForm.age}
                    onChange={(event) =>
                      setPatientForm((prev) => ({ ...prev, age: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Gender
                  <input
                    value={patientForm.gender}
                    onChange={(event) =>
                      setPatientForm((prev) => ({ ...prev, gender: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Blood Group
                  <input
                    value={patientForm.blood_group}
                    onChange={(event) =>
                      setPatientForm((prev) => ({
                        ...prev,
                        blood_group: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="wide">
                  Medical History Summary
                  <textarea
                    rows="4"
                    value={patientForm.medical_history}
                    onChange={(event) =>
                      setPatientForm((prev) => ({
                        ...prev,
                        medical_history: event.target.value,
                      }))
                    }
                  />
                </label>

                <button type="submit" disabled={busyMap["patient-save"]}>
                  <UserRoundPen size={16} />
                  Save Patient Changes
                </button>
              </form>

              <div className="staff-report-panel">
                <div className="staff-report-upload">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={handleUploadReport}
                    disabled={!uploadFile || busyMap["report-upload"]}
                  >
                    <FileUp size={16} />
                    Upload Report
                  </button>
                </div>

                <div className="staff-report-list">
                  {patientReports.map((report) => (
                    <a
                      key={report.id}
                      href={report.secure_url || report.file_path}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {report.file_name}
                    </a>
                  ))}
                  {patientReports.length === 0 && (
                    <span className="staff-muted">No reports uploaded yet.</span>
                  )}
                </div>
              </div>
            </>
          )}
        </article>

        <article className="staff-panel">
          <div className="staff-panel-header">
            <div>
              <h2>Daily Activity</h2>
              <p>Operational logs and staff productivity snapshot.</p>
            </div>
          </div>

          <div className="staff-activity-grid">
            <div>
              <h3>Recent Logs</h3>
              <div className="staff-log-list">
                {logs.map((entry) => (
                  <div key={entry.id} className="staff-log-row">
                    <ClipboardPlus size={16} />
                    <div>
                      <strong>{entry.action}</strong>
                      <span>{formatDateTime12Hour(entry.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3>Performance</h3>
              <div className="staff-performance-list">
                {performance.map((entry) => (
                  <div key={entry.staff_id} className="staff-performance-row">
                    <div>
                      <strong>{entry.staff_name}</strong>
                      <span>{entry.department || "General"}</span>
                    </div>
                    <b>{entry.actions_today} actions</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
