import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { appointmentAPI, queueAPI, analyticsAPI } from "../../api/techmedixAPI";
import DoctorScheduleManager from "../../components/DoctorScheduleManager/DoctorScheduleManager";
import { Html5Qrcode } from "html5-qrcode";
import { doctorApi, paymentApi } from "../../api";
import "./DoctorDashboardNew.css";

/**
 * DOCTOR DASHBOARD - Complete doctor interface
 * View queue, manage appointments, analytics, earnings, schedule
 */
export default function DoctorDashboardNew() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [consultationFee, setConsultationFee] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);

  /* ===== PATIENT SEARCH / QR ===== */
  const [uniqueCode, setUniqueCode] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  /* ===== AUDIO RECORDING ===== */
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState(null);

  /* ===== MANUAL MEDICINE ADD ===== */
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineDosage, setNewMedicineDosage] = useState("");
  const [newMedicineFrequency, setNewMedicineFrequency] = useState("");
  const [newMedicineDuration, setNewMedicineDuration] = useState("");
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const qrRefId = "doctor-qr-reader";

  useEffect(() => {
    if (user?.id) {
      loadDoctorData();
    }

    // fetch doctor profile for fee
    async function fetchProfile() {
      setProfileLoading(true);
      try {
        const res = await doctorApi.getProfile();
        if (res.data?.data) {
          setConsultationFee(res.data.data.consultation_fee || 0);
        }
      } catch (err) {
        console.warn("Failed to load profile", err);
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, [user, selectedDate]);

  /* ================= QR SCANNER ================= */
  useEffect(() => {
    let qr;

    const startScanner = async () => {
      try {
        qr = new Html5Qrcode(qrRefId);

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            setUniqueCode(decodedText);
            setScannerVisible(false);

            try {
              await qr.stop();
            } catch {}

            try {
              const res = await doctorApi.getPatientData(decodedText);
              console.log("Scanned patient data:", res.data);
              setPatientData(res.data);
              loadPatientPrescriptions((res.data.patient || res.data).id);
            } catch {
              setError("Failed to load patient data");
            }
          },
        );
      } catch (err) {
        console.error("QR scanner error:", err);
      }
    };

    if (scannerVisible) {
      startScanner();
    }

    return () => {
      if (qr) {
        try {
          qr.stop();
        } catch {}
      }
    };
  }, [scannerVisible]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      const [queueRes, apptRes, analyticsRes, earningsRes] =
        await Promise.allSettled([
          queueAPI.getForDoctor(user.id, selectedDate),
          appointmentAPI.getByDoctor(user.id, selectedDate),
          analyticsAPI.getDoctorStats(user.id),
          paymentApi.getDoctorSummary(user.id),
        ]);

      let queueData = [];
      let appointmentData = [];

      if (queueRes.status === "fulfilled") {
        queueData = queueRes.value.data.data || [];
      }

      if (apptRes.status === "fulfilled") {
        appointmentData = apptRes.value.data.data || [];
        setAppointments(appointmentData);
      }

      /* If queue API returns empty but appointments exist,
   generate queue from appointments */
      if (queueData.length === 0 && appointmentData.length > 0) {
        queueData = appointmentData.map((apt, index) => ({
          appointment_id: apt.id,
          patient_name: apt.patient_name,
          token_number: index + 1,
          position_in_queue: index + 1,
          status: apt.status || "booked",
        }));
      }

      setQueue(queueData);
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value.data.data || {});
      }
      if (earningsRes && earningsRes.status === "fulfilled") {
        setEarnings(earningsRes.value.data || {});
      }
    } catch (err) {
      setError("Failed to load doctor data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkArrived = async (appointmentId) => {
    try {
      await queueAPI.markArrived(appointmentId);
      loadDoctorData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };
  const loadPatientPrescriptions = async (patientId) => {
    try {
      const res = await fetch(`/api/v2/prescriptions/patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Prescription API error response:", text);
        throw new Error("Prescription API request failed");
      }

      const data = await res.json();
      console.log("Prescription API response:", data);

      const prescriptions = data.data || data || [];

      let medicines = [];

      // Case 1: prescriptions contain medicines array
      if (
        Array.isArray(prescriptions) &&
        prescriptions.length &&
        prescriptions[0].medicines
      ) {
        medicines = prescriptions.flatMap((p) => p.medicines || []);
      }
      // Case 2: prescriptions are already medicine rows
      else if (Array.isArray(prescriptions)) {
        medicines = prescriptions;
      }

      console.log("Parsed medicines:", medicines);

      setPatientPrescriptions(medicines);
    } catch (err) {
      console.error("Failed to load prescriptions:", err);
    }
  };
  const handleStartConsultation = async (appointmentId) => {
    try {
      await queueAPI.startConsultation(appointmentId);
      loadDoctorData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleCompleteConsultation = async (appointmentId) => {
    try {
      await queueAPI.completeConsultation(appointmentId);

      // Remove completed patient from queue instantly
      setQueue((prevQueue) =>
        prevQueue.filter((p) => p.appointment_id !== appointmentId),
      );

      // Update appointments status locally
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId ? { ...a, status: "completed" } : a,
        ),
      );
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  /* ================= PATIENT SEARCH ================= */
  const handleSearchPatient = async (e) => {
    e.preventDefault();
    try {
      const res = await doctorApi.getPatientData(uniqueCode);
      console.log("Searched patient data:", res.data);
      setPatientData(res.data);
      loadPatientPrescriptions((res.data.patient || res.data).id);
    } catch (err) {
      setError("Patient not found");
    }
  };

  /* ================= RECORD PRESCRIPTION ================= */
  const startRecording = async () => {
    try {
      setIsRecording(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
    } catch {
      setIsRecording(false);
      setError("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const uploadRecording = async () => {
    if (!audioBlob) {
      alert("Record audio first");
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob);

    try {
      await doctorApi.uploadRecording(formData);
      setAudioBlob(null);
      setAudioURL("");
      alert("Recording uploaded successfully");
    } catch {
      setError("Upload failed");
    }
  };

  /* ================= ADD MEDICINE ================= */
  const handleAddMedicine = async () => {
    if (!newMedicineName) {
      alert("Enter medicine name");
      return;
    }

    try {
      await fetch("/api/prescriptions/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          patient_id: (patientData.patient || patientData).id,
          medicine_name: newMedicineName,
          dosage: newMedicineDosage,
          frequency: newMedicineFrequency,
          duration: newMedicineDuration,
        }),
      });

      alert("Medicine added to prescription");
      loadPatientPrescriptions((patientData.patient || patientData).id);

      setNewMedicineName("");
      setNewMedicineDosage("");
      setNewMedicineFrequency("");
      setNewMedicineDuration("");
    } catch (err) {
      console.error(err);
      alert("Failed to add medicine");
    }
  };

  if (loading)
    return (
      <div className="doctor-dashboard">
        <p>Loading...</p>
      </div>
    );

  return (
    <div className="doctor-dashboard">
      <header className="doc-header">
        <h1>Welcome, Dr. {user?.name}</h1>
        <p>Branch: {user?.branch_name || "N/A"}</p>
        <div className="fee-management">
          <label>Fee: ₹</label>
          <input
            type="number"
            value={consultationFee}
            onChange={(e) => setConsultationFee(e.target.value)}
            disabled={profileLoading}
          />
          <button
            onClick={async () => {
              try {
                await doctorApi.updateProfile({
                  consultation_fee: consultationFee,
                });
                alert("Consultation fee updated");
              } catch (err) {
                setError("Failed to update fee");
              }
            }}
          >
            Save
          </button>
        </div>
      </header>

      <div className="doc-tabs">
        <button
          className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          🚦 Queue
        </button>
        <button
          className={`tab-btn ${activeTab === "appointments" ? "active" : ""}`}
          onClick={() => setActiveTab("appointments")}
        >
          📅 Appointments
        </button>
        <button
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === "earnings" ? "active" : ""}`}
          onClick={() => setActiveTab("earnings")}
        >
          💰 Earnings
        </button>
        <button
          className={`tab-btn ${activeTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          🗓️ My Schedule
        </button>

        <button
          className={`tab-btn ${activeTab === "scanner" ? "active" : ""}`}
          onClick={() => setActiveTab("scanner")}
        >
          📷 Scan Patient
        </button>
      </div>

      <div className="doc-content">
        {error && <div className="error-message">{error}</div>}

        {/* QUEUE TAB */}
        {activeTab === "queue" && (
          <div className="tab-content queue-tab">
            <div className="date-picker">
              <label>Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="queue-stats">
              <div className="stat">
                <h4>{queue.length}</h4>
                <p>Total</p>
              </div>

              <div className="stat">
                <h4>
                  {
                    queue.filter(
                      (p) => p.status === "booked" || p.status === "arrived",
                    ).length
                  }
                </h4>
                <p>Waiting</p>
              </div>

              <div className="stat">
                <h4>
                  {
                    queue.filter(
                      (p) => p.status === "completed" || p.status === "visited",
                    ).length
                  }
                </h4>
                <p>Completed</p>
              </div>
            </div>

            <div className="queue-list">
              <h3>Queue Order</h3>
              {queue.length === 0 ? (
                <p>No patients in queue for this date</p>
              ) : (
                queue.map((patient, idx) => (
                  <div
                    key={patient.appointment_id}
                    className={`queue-item ${patient.status}`}
                  >
                    <div className="token">#{patient.token_number}</div>
                    <div className="patient-info">
                      <p className="name">{patient.patient_name}</p>
                      <p className="time">
                        Position: {patient.position_in_queue}
                      </p>
                      <p className="status">{patient.status.toUpperCase()}</p>
                    </div>
                    <div className="queue-actions">
                      {(patient.status === "arrived" ||
                        patient.status === "booked") && (
                        <button
                          className="btn-start"
                          onClick={() =>
                            handleStartConsultation(patient.appointment_id)
                          }
                        >
                          ▶ Start Consultation
                        </button>
                      )}

                      {(patient.status === "in_progress" ||
                        patient.status === "arrived") && (
                        <button
                          className="btn-complete"
                          onClick={() =>
                            handleCompleteConsultation(patient.appointment_id)
                          }
                        >
                          ✓ Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="tab-content appointments-tab">
            <h3>Today's Appointments ({appointments.length})</h3>
            <div className="appointments-grid">
              {appointments.length === 0 ? (
                <p>No appointments scheduled</p>
              ) : (
                appointments.map((apt) => (
                  <div key={apt.id} className="appointment-item">
                    <h4>{apt.patient_name}</h4>
                    <p>🕐 {apt.slot_time}</p>
                    <p>Status: {apt.status}</p>
                    <p>
                      Payment: {apt.payment_status || "N/A"} (
                      {apt.payment_method || "-"})
                    </p>
                    <small>ID: {apt.id}</small>
                    {apt.payment_method === "cash" &&
                      apt.payment_status === "due" && (
                        <button
                          onClick={async () => {
                            try {
                              await paymentApi.markCashPaid({
                                payment_id: apt.payment_id,
                              });
                              loadDoctorData();
                              alert("Cash payment received");
                            } catch (err) {
                              setError("Failed to mark cash payment");
                            }
                          }}
                        >
                          Mark Payment Received
                        </button>
                      )}
                    {apt.status === "booked" && (
                      <button
                        onClick={async () => {
                          try {
                            await doctorApi.updateAppointmentStatus(
                              apt.id,
                              "visited",
                            );
                            loadDoctorData();
                            alert("Appointment marked visited");
                          } catch (err) {
                            setError("Failed to update status");
                          }
                        }}
                      >
                        Mark Visited
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="tab-content analytics-tab">
            <h3>Analytics</h3>
            {analytics && (
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h4>Patients Today</h4>
                  <p className="big-number">{analytics.patients_today || 0}</p>
                </div>
                <div className="analytics-card">
                  <h4>Avg Consultation Time</h4>
                  <p className="big-number">
                    {analytics.avg_consultation_time || 15}m
                  </p>
                </div>
                <div className="analytics-card">
                  <h4>Completion Rate</h4>
                  <p className="big-number">
                    {analytics.completion_rate || 0}%
                  </p>
                </div>
                <div className="analytics-card">
                  <h4>No-Show Rate</h4>
                  <p className="big-number">{analytics.no_show_rate || 0}%</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EARNINGS TAB */}
        {activeTab === "earnings" && (
          <div className="tab-content earnings-tab">
            <h3>Earnings Summary</h3>
            {analytics && (
              <div className="earnings-grid">
                <div className="earnings-card">
                  <h4>Today's Earnings</h4>
                  <p className="amount">₹{earnings?.today_earnings || 0}</p>
                </div>
                <div className="earnings-card">
                  <h4>This Month</h4>
                  <p className="amount">₹{earnings?.monthly_earnings || 0}</p>
                </div>
                <div className="earnings-card">
                  <h4>Total Earnings</h4>
                  <p className="amount">₹{earnings?.total_earnings || 0}</p>
                </div>
                <div className="earnings-card">
                  <h4>Total Consulted</h4>
                  <p className="amount">
                    {earnings?.completed_consultations || 0}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === "schedule" && (
          <div className="tab-content schedule-tab">
            <DoctorScheduleManager doctorId={user?.id} />
          </div>
        )}

        {/* SCANNER TAB */}
        {activeTab === "scanner" && (
          <div className="tab-content">
            <h3 className="section-title">Scan Patient QR</h3>

            <div className="scanner-controls">
              <button
                className="primary-btn"
                onClick={() => setScannerVisible(!scannerVisible)}
              >
                {scannerVisible ? "Close Scanner" : "Open Scanner"}
              </button>
            </div>

            {scannerVisible && (
              <div className="scanner-box">
                <div id={qrRefId} />
              </div>
            )}

            <h4 className="section-subtitle">Search Patient</h4>

            <form className="patient-search" onSubmit={handleSearchPatient}>
              <input
                className="search-input"
                value={uniqueCode}
                onChange={(e) => setUniqueCode(e.target.value)}
                placeholder="Enter Patient Code"
                required
              />
              <button className="primary-btn" type="submit">
                Search
              </button>
            </form>

            {(patientData?.patient || patientData?.id) && (
              <div className="patient-dashboard-card modern-card">
                <div className="patient-header">
                  <h3>Patient Profile</h3>
                </div>

                <div className="patient-info-grid">
                  <div className="info-item">
                    <span className="label">Name</span>
                    <span className="value">
                      {(patientData.patient || patientData).name}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="label">Email</span>
                    <span className="value">
                      {(patientData.patient || patientData).email}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="label">Age</span>
                    <span className="value">
                      {(patientData.patient || patientData).age}
                    </span>
                  </div>
                </div>

                <h4 className="section-subtitle">Add Medicine</h4>

                <div
                  style={{ display: "grid", gap: "8px", marginBottom: "16px" }}
                >
                  <input
                    placeholder="Medicine Name"
                    value={newMedicineName}
                    onChange={(e) => setNewMedicineName(e.target.value)}
                  />

                  <input
                    placeholder="Dosage (e.g. 500mg)"
                    value={newMedicineDosage}
                    onChange={(e) => setNewMedicineDosage(e.target.value)}
                  />

                  <input
                    placeholder="Frequency (e.g. Twice a day)"
                    value={newMedicineFrequency}
                    onChange={(e) => setNewMedicineFrequency(e.target.value)}
                  />

                  <input
                    placeholder="Duration (e.g. 5 days)"
                    value={newMedicineDuration}
                    onChange={(e) => setNewMedicineDuration(e.target.value)}
                  />

                  <button className="primary-btn" onClick={handleAddMedicine}>
                    ➕ Add Medicine
                  </button>
                </div>

                <h4 className="section-subtitle">Record Voice Prescription</h4>

                {!isRecording && (
                  <button className="primary-btn" onClick={startRecording}>
                    🎤 Start Recording
                  </button>
                )}

                {isRecording && (
                  <button className="danger-btn" onClick={stopRecording}>
                    ⏹ Stop Recording
                  </button>
                )}

                {audioURL && (
                  <>
                    <audio controls src={audioURL} />
                    <button
                      className="primary-btn"
                      onClick={async () => {
                        if (!audioBlob) return;

                        const formData = new FormData();
                        formData.append("audio", audioBlob);
                        formData.append(
                          "patient_id",
                          (patientData.patient || patientData).id,
                        );

                        try {
                          await doctorApi.uploadRecording(formData);
                          // alert("Prescription uploaded successfully");
                          setAudioBlob(null);
                          setAudioURL("");
                        } catch {
                          setError("Upload failed");
                        }
                      }}
                    >
                      Upload Prescription
                    </button>
                  </>
                )}
                <h4 className="section-subtitle">Active Prescriptions</h4>

                {patientPrescriptions.length === 0 ? (
                  <p>No active prescriptions</p>
                ) : (
                  <div style={{ marginBottom: "20px" }}>
                    {patientPrescriptions.map((pres, i) => (
                      <div
                        key={
                          pres.id ||
                          pres.medicine_id ||
                          pres.prescription_medicine_id ||
                          i
                        }
                        style={{
                          border: "1px solid #ddd",
                          padding: "10px",
                          borderRadius: "8px",
                          marginBottom: "8px",
                          background: "#f9f9f9",
                        }}
                      >
                        <strong>{pres.medicine_name}</strong>
                        <div>Dosage: {pres.dosage || "-"}</div>
                        <div>Frequency: {pres.frequency || "-"}</div>
                        <div>Duration: {pres.duration || "-"}</div>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Compare With Salt */}
                          <button
                            className="primary-btn"
                            onClick={() => {
                              window.location.href = `/search?medicine=${encodeURIComponent(
                                pres.medicine_name,
                              )}`;
                            }}
                          >
                            🔍 Compare with Salt
                          </button>

                          {/* Edit Dose */}
                          <button
                            className="primary-btn"
                            onClick={async () => {
                              const medId =
                                pres.id ||
                                pres.medicine_id ||
                                pres.prescription_medicine_id ||
                                pres.pm_id ||
                                pres._id;
                              if (!medId) {
                                alert(
                                  "Medicine ID not found. Cannot update this medicine.",
                                );
                                console.error("Missing medicine id:", pres);
                                return;
                              }

                              const newDosage = prompt(
                                "Enter new dosage:",
                                pres.dosage || "",
                              );
                              if (newDosage === null) return;

                              const newFrequency = prompt(
                                "Enter new frequency:",
                                pres.frequency || "",
                              );
                              if (newFrequency === null) return;

                              const newDuration = prompt(
                                "Enter new duration:",
                                pres.duration || "",
                              );
                              if (newDuration === null) return;

                              try {
                                const res = await fetch(
                                  `/api/v2/prescriptions/medicine/${medId}`,
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                                    },
                                    body: JSON.stringify({
                                      dosage: newDosage,
                                      frequency: newFrequency,
                                      duration: newDuration,
                                    }),
                                  },
                                );

                                if (!res.ok) {
                                  const text = await res.text();
                                  console.error("Update medicine error:", text);
                                  throw new Error("Update failed");
                                }

                                alert("Medicine updated");
                                loadPatientPrescriptions(
                                  (patientData.patient || patientData).id,
                                );
                              } catch (err) {
                                console.error(err);
                                alert("Failed to update medicine");
                              }
                            }}
                          >
                            ✏ Edit Dose
                          </button>

                          {/* Stop Medicine */}
                          <button
                            className="danger-btn"
                            onClick={async () => {
                              const medId =
                                pres.medicine_id ??
                                pres.id ??
                                pres.prescription_medicine_id ??
                                pres.pm_id ??
                                pres._id;
                              if (!medId) {
                                // alert("Medicine ID not found. Cannot stop this medicine.");
                                console.error("Missing medicine id:", pres);
                                return;
                              }

                              // if (!window.confirm("Stop this medicine?")) return;

                              try {
                                const res = await fetch(
                                  `/api/v2/prescriptions/medicine/${medId}`,
                                  {
                                    method: "DELETE",
                                    headers: {
                                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                                    },
                                  },
                                );

                                if (!res.ok) {
                                  const text = await res.text();
                                  console.error("Stop medicine error:", text);
                                  throw new Error("Delete failed");
                                }

                                // alert("Medicine stopped");
                                loadPatientPrescriptions(
                                  (patientData.patient || patientData).id,
                                );
                              } catch (err) {
                                console.error(err);
                                alert("Failed to stop medicine");
                              }
                            }}
                          >
                            🛑 Stop Medicine
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* ===== FULL EHR HISTORY ===== */}
                {patientData?.ehrHistory &&
                  patientData.ehrHistory.length > 0 && (
                    <>
                      <h4 style={{ marginTop: 20 }}>Patient Medical Records</h4>

                      {patientData.ehrHistory.map((record, index) => (
                        <div
                          key={index}
                          style={{
                            border: "1px solid #ddd",
                            padding: "12px",
                            borderRadius: "8px",
                            marginBottom: "10px",
                            background: "#fafafa",
                          }}
                        >
                          <p>
                            <strong>Date:</strong>{" "}
                            {new Date(record.timestamp).toLocaleDateString()}
                          </p>

                          {/* Health Metrics */}
                          {record.ehr && (
                            <>
                              <p>
                                <strong>Health Metrics:</strong>
                              </p>
                              <ul>
                                {Object.entries(record.ehr).map(
                                  ([key, value]) =>
                                    typeof value !== "object" ? (
                                      <li key={key}>
                                        {key}: {String(value)}
                                      </li>
                                    ) : null,
                                )}
                              </ul>
                            </>
                          )}

                          {/* Blood Pressure */}
                          {record.ehr?.bloodPressure && (
                            <p>
                              <strong>Blood Pressure:</strong>{" "}
                              {record.ehr.bloodPressure.systolic}/
                              {record.ehr.bloodPressure.diastolic}
                            </p>
                          )}

                          {/* Symptoms */}
                          {record.symptoms &&
                            Object.keys(record.symptoms).length > 0 && (
                              <>
                                <p>
                                  <strong>Symptoms:</strong>
                                </p>
                                <ul>
                                  {Object.entries(record.symptoms).map(
                                    ([k, v]) => (
                                      <li key={k}>
                                        {k}: {v}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </>
                            )}

                          {/* Medicines */}
                          {record.medicines && record.medicines.length > 0 && (
                            <>
                              <p>
                                <strong>Medicines:</strong>
                              </p>
                              <ul>
                                {record.medicines.map((med, i) => (
                                  <li key={i}>
                                    {med.name} — {med.dosage} ({med.frequency})
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}

                          {/* Predicted Disease */}
                          {record.predictedDisease && (
                            <p>
                              <strong>AI Predicted Disease:</strong>{" "}
                              {record.predictedDisease}
                            </p>
                          )}

                          {/* AI Insights */}
                          {record.aiInsights && (
                            <p>
                              <strong>AI Insights:</strong> {record.aiInsights}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                {patientData.history && (
                  <>
                    <h4 style={{ marginTop: 20 }}>Medical History</h4>
                    <ul>
                      {patientData.history.map((h, i) => (
                        <li key={i}>
                          {h.description || h.notes || JSON.stringify(h)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
