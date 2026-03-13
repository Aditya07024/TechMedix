import React, { useState, useEffect } from "react";
import { doctorApi, paymentApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./DoctorDashboard.css";
import { Html5Qrcode } from "html5-qrcode";

const DoctorDashboard = () => {
  const { user } = useAuth();

  const [earnings, setEarnings] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [consultationFee, setConsultationFee] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const [uniqueCode, setUniqueCode] = useState("");
  const [patientData, setPatientData] = useState(null);

  const [scannerVisible, setScannerVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const qrRefId = "doctor-qr-reader";

  /* ================= EARNINGS ================= */
  useEffect(() => {
    if (!user?.id) return;
    paymentApi
      .getDoctorSummary(user.id)
      .then((res) => setEarnings(res.data))
      .catch(() => {});

    // load profile to get consultation fee
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
  }, [user]);

  /* ================= APPOINTMENTS ================= */
  const fetchAppointments = async () => {
    if (!user?.id) return;
    try {
      const res = await doctorApi.getDoctorAppointments(user.id);
      setAppointments(res.data || []);
    } catch (err) {
      setError("Failed to load appointments");
      console.warn(err);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  /* ================= RECORDINGS ================= */
  const fetchDoctorRecordings = async () => {
    if (!user?.id) return;
    try {
      const res = await doctorApi.getDoctorRecordings(user.id);
      setRecordings(res.data || []);
    } catch (err) {
      console.warn("Failed to load recordings:", err);
    }
  };

  useEffect(() => {
    fetchDoctorRecordings();
  }, [user]);

  /* ================= STATUS UPDATE ================= */
  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      const res = await doctorApi.updateAppointmentStatus(
        appointmentId,
        newStatus,
      );
      if (res.data?.success) {
        fetchAppointments();
        alert(`Status updated to ${newStatus}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update status");
    }
  };

  /* ================= QR SCANNER ================= */
  useEffect(() => {
    let qr;
    if (scannerVisible) {
      qr = new Html5Qrcode(qrRefId);
      qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          setUniqueCode(decodedText);
          setScannerVisible(false);
          qr.stop();
        },
      );
    }

    return () => {
      if (qr) qr.stop().catch(() => {});
    };
  }, [scannerVisible]);

  /* ================= PATIENT SEARCH ================= */
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await doctorApi.getPatientData(uniqueCode);
      setPatientData(res.data);
    } catch (err) {
      setError("Patient not found");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RECORDING ================= */
  const handleRecord = async () => {
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

  const handleStop = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSaveRecording = async () => {
    if (!audioBlob || !selectedAppointment) {
      setError("Select appointment first");
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob);
    formData.append("appointment_id", selectedAppointment.id);
    formData.append("patient_id", selectedAppointment.patient_id);

    try {
      await doctorApi.uploadRecording(formData);
      setAudioBlob(null);
      setAudioURL("");
      fetchDoctorRecordings();
      alert("Recording uploaded");
    } catch {
      setError("Upload failed");
    }
  };

  if (!user || user.role !== "doctor") {
    return <div className="doctor-dashboard-container">Unauthorized</div>;
  }

  return (
    <div className="doctor-dashboard-container">
      <h2>Welcome Dr. {user.name}</h2>

      {/* consultation fee management */}
      <div className="dashboard-card">
        <h3>Consultation Fee</h3>
        {profileLoading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <input
              type="number"
              value={consultationFee}
              onChange={(e) => setConsultationFee(e.target.value)}
              placeholder="Fee in rupees"
            />
            <button
              onClick={async () => {
                try {
                  await doctorApi.updateProfile({
                    consultation_fee: consultationFee,
                  });
                  alert("Fee updated");
                } catch (err) {
                  setError("Failed to update fee");
                }
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {earnings && (
        <div className="dashboard-card">
          <h3>Earnings</h3>
          <p>Total: ₹{earnings.total_earnings}</p>
          <p>Today: ₹{earnings.today_earnings}</p>
          <p>Month: ₹{earnings.monthly_earnings}</p>
          <p>Online: ₹{earnings.online_earnings}</p>
          <p>Cash: ₹{earnings.cash_earnings}</p>
          <p>Completed Consultations: {earnings.total_paid_appointments}</p>
        </div>
      )}

      <div className="dashboard-card">
        <h3>Appointments</h3>
        {appointments.length === 0 && <p>No appointments</p>}
        {appointments.map((appt) => (
          <div key={appt.id} className="appointment-item">
            <p>
              <strong>Patient:</strong> {appt.patient_name}
            </p>
            <p>
              <strong>Status:</strong> {appt.status}
            </p>
            <p>
              <strong>Payment:</strong> {appt.payment_status || "N/A"} (
              {appt.payment_method || "-"})
            </p>
            <button onClick={() => setSelectedAppointment(appt)}>Select</button>

            {appt.payment_method === "cash" &&
              appt.payment_status === "due" && (
                <button
                  onClick={async () => {
                    try {
                      await paymentApi.markCashPaid({
                        payment_id: appt.payment_id,
                      });
                      fetchAppointments();
                      alert("Cash payment marked received");
                    } catch (err) {
                      setError("Failed to mark cash payment");
                    }
                  }}
                >
                  Mark Payment Received
                </button>
              )}

            {appt.status === "booked" && (
              <button onClick={() => handleUpdateStatus(appt.id, "visited")}>
                Mark Visited
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="dashboard-card">
        <h3>Record Prescription</h3>

        {!isRecording && <button onClick={handleRecord}>Start</button>}
        {isRecording && <button onClick={handleStop}>Stop</button>}

        {audioURL && (
          <>
            <audio controls src={audioURL} />
            <button onClick={handleSaveRecording}>Upload</button>
          </>
        )}
      </div>

      <div className="dashboard-card">
        <h3>My Recordings</h3>
        {recordings.map((rec) => (
          <div key={rec.id}>
            <audio controls src={rec.audio_url} />
          </div>
        ))}
      </div>

      <div className="dashboard-card">
        <h3>Scan Patient QR</h3>
        <button onClick={() => setScannerVisible(!scannerVisible)}>
          {scannerVisible ? "Close Scanner" : "Open Scanner"}
        </button>
        {scannerVisible && <div id={qrRefId} style={{ width: 300 }} />}
      </div>

      <div className="dashboard-card">
        <h3>Search Patient</h3>
        <form onSubmit={handleSearch}>
          <input
            value={uniqueCode}
            onChange={(e) => setUniqueCode(e.target.value)}
            placeholder="Enter Unique Code"
            required
          />
          <button type="submit">{loading ? "Searching..." : "Search"}</button>
        </form>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

      {patientData?.patient && (
        <div className="dashboard-card">
          <h3>Patient Details</h3>
          <p>Name: {patientData.patient.name}</p>
          <p>Email: {patientData.patient.email}</p>
          <p>Age: {patientData.patient.age}</p>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
