import React, { useEffect, useMemo, useState } from "react";
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
import { staffApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { subscribeToQueue } from "../../api/socketService";
import "./StaffDashboard.css";

const QUEUE_STATUS_OPTIONS = ["waiting", "in-progress", "completed"];

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
  const [queue, setQueue] = useState([]);
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

  const doctorOptions = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      if (!map.has(item.doctor_id)) {
        map.set(item.doctor_id, item.doctor_name);
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [appointments]);

  async function loadDashboard(doctorId = selectedDoctorId) {
    try {
      setLoading(true);
      const [doctorsRes, overviewRes, appointmentsRes, logsRes, performanceRes] = await Promise.allSettled([
        staffApi.getDoctors(),
        staffApi.getOverview(doctorId ? { doctor_id: doctorId } : undefined),
        staffApi.getTodayAppointments(doctorId ? { doctor_id: doctorId } : {}),
        staffApi.getActivity(),
        staffApi.getPerformance(doctorId ? { doctor_id: doctorId } : undefined),
      ]);

      const doctors = doctorsRes.status === "fulfilled" ? doctorsRes.value.data?.data || [] : [];
      const appointmentRows =
        appointmentsRes.status === "fulfilled"
          ? appointmentsRes.value.data?.data || []
          : [];
      const resolvedDoctorId =
        doctorId ||
        doctors.find((entry) => entry.id === user?.active_doctor_id)?.id ||
        doctors[0]?.id ||
        appointmentRows[0]?.doctor_id ||
        "";

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

      if (resolvedDoctorId) {
        const queueRes = await staffApi.getLiveQueue(resolvedDoctorId);
        setQueue(queueRes.data?.data || []);
      } else {
        setQueue([]);
      }

      const firstError = [doctorsRes, overviewRes, appointmentsRes, logsRes, performanceRes]
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
    if (!patientId) return;

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
    if (!selectedDoctorId) return undefined;
    return subscribeToQueue(selectedDoctorId, async () => {
      try {
        const queueRes = await staffApi.getLiveQueue(selectedDoctorId);
        setQueue(queueRes.data?.data || []);
      } catch {}
    });
  }, [selectedDoctorId]);

  useEffect(() => {
    if (selectedPatientId) {
      loadPatient(selectedPatientId);
    }
  }, [selectedPatientId]);

  const withBusy = async (key, fn) => {
    setBusyMap((prev) => ({ ...prev, [key]: true }));
    setStatusMessage("");
    try {
      await fn();
    } catch (err) {
      setStatusMessage(err.response?.data?.error || err.message || "Action failed");
    } finally {
      setBusyMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleGenerateToken = (appointmentId, patientId) =>
    withBusy(`token-${appointmentId}`, async () => {
      await staffApi.generateToken(appointmentId);
      setSelectedPatientId(patientId);
      setStatusMessage("Queue token generated.");
      await loadDashboard(selectedDoctorId);
    });

  const handleMarkArrived = (appointmentId) =>
    withBusy(`arrive-${appointmentId}`, async () => {
      await staffApi.markArrived(appointmentId);
      setStatusMessage("Appointment marked as arrived.");
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

  const handleSwitchDoctor = (doctorId) =>
    withBusy(`switch-${doctorId}`, async () => {
      await staffApi.switchDoctor(doctorId);
      setSelectedDoctorId(doctorId);
      setStatusMessage("Active doctor switched.");
      await loadDashboard(doctorId);
    });

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
            Welcome, {user?.name || "Staff"}. Manage arrivals, queue tokens, reports,
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

      {statusMessage && <div className="staff-status-banner">{statusMessage}</div>}

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
          <div className="staff-panel-header">
            <div>
              <h2>My Doctors</h2>
              <p>Switch the active doctor context before handling queue data.</p>
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
                  <button
                    type="button"
                    className={selectedDoctorId === doctor.id ? "active" : ""}
                    onClick={() => handleSwitchDoctor(doctor.id)}
                    disabled={busyMap[`switch-${doctor.id}`]}
                  >
                    {selectedDoctorId === doctor.id ? "Active" : "Switch"}
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
              <p>Check in patients and issue queue tokens.</p>
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
              {doctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
              {doctorOptions.length === 0 &&
                assignedDoctors.map((doctor) => (
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
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
                      <td>{appointment.slot_time || "-"}</td>
                      <td>
                        <span className={`staff-pill status-${appointment.status}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="staff-row-actions">
                        <button
                          type="button"
                          onClick={() => handleMarkArrived(appointment.id)}
                          disabled={busyMap[`arrive-${appointment.id}`]}
                        >
                          Check In
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleGenerateToken(appointment.id, appointment.patient_id)
                          }
                          disabled={busyMap[`token-${appointment.id}`]}
                        >
                          Token
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
              <p>Real-time queue state for the selected doctor.</p>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="staff-empty-state">No queue entries for this doctor.</div>
          ) : (
            <div className="staff-queue-list">
              {queue.map((entry) => (
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
                      <span>{new Date(entry.created_at).toLocaleString()}</span>
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
