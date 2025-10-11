import React, { useState } from "react";
import { doctorApi, patientDataApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { QrReader } from "react-qr-reader"; // Import QrReader
import "./DoctorDashboard.css";

const DoctorDashboard = () => {
  const [uniqueCode, setUniqueCode] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [scanning, setScanning] = useState(false); // State to control scanning
  const { user } = useAuth(); // Assuming user context has doctor info

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setPatientData(null);
    setQrCodeImage("");

    try {
      const res = await doctorApi.getPatientData(uniqueCode);
      setPatientData(res.data); // res.data will contain { patient, ehrHistory }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch patient data");
    }
  };

  const handleGenerateQrCode = async (patientId) => {
    setError("");
    setQrCodeImage("");
    try {
      const res = await patientDataApi.generatePatientQR(patientId);
      setQrCodeImage(res.data.qrCode);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate QR code");
    }
  };

  const handleScan = async (result, error) => {
    if (result) {
      setScanning(false); // Stop scanning after successful scan
      try {
        const scannedData = JSON.parse(result?.text); // Assuming QR code contains JSON with uniqueCode
        if (scannedData && scannedData.uniqueCode) {
          setUniqueCode(scannedData.uniqueCode);
          // Directly fetch data after scanning
          try {
            const res = await doctorApi.getPatientData(scannedData.uniqueCode);
            setPatientData(res.data);
            setError("");
          } catch (err) {
            setError(
              err.response?.data?.message ||
                "Failed to fetch patient data after scan"
            );
          }
        } else {
          setError("Invalid QR code format. Unique code not found.");
        }
      } catch (parseError) {
        setError("Error parsing QR code data. Please ensure it's valid JSON.");
        console.error("QR Parse Error:", parseError);
      }
    }
    if (error) {
      // console.info(error);
    }
  };

  if (!user || user.role !== "doctor") {
    return (
      <div className="doctor-dashboard-container">
        Unauthorized access. Please log in as a doctor.
      </div>
    );
  }

  return (
    <div className="doctor-dashboard-container">
      <h2>Welcome, Dr. {user.name}</h2>
      <div className="search-patient-section">
        <h3>Access Patient Data</h3>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Enter Patient Unique Code"
            value={uniqueCode}
            onChange={(e) => setUniqueCode(e.target.value)}
            required
          />
          <button type="submit">Search Patient</button>
        </form>
        <button onClick={() => setScanning(true)} className="scan-qr-button">
          Scan QR Code
        </button>
        {error && <p className="error-message">{error}</p>}
      </div>

      {scanning && (
        <div className="qr-scanner-container">
          <h3>Scan Patient QR Code</h3>
          <QrReader
            onResult={handleScan}
            constraints={{ facingMode: "environment" }} // Prefer back camera
            scanDelay={500}
            videoStyle={{ width: "100%" }}
            containerStyle={{
              width: "100%",
              padding: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          />
          <button
            onClick={() => setScanning(false)}
            className="cancel-scan-button"
          >
            Cancel Scan
          </button>
        </div>
      )}

      {patientData && (
        <div className="patient-data-display">
          <h3>Patient Information</h3>
          <p>
            <strong>Name:</strong> {patientData.patient.name}
          </p>
          <p>
            <strong>Email:</strong> {patientData.patient.email}
          </p>
          <p>
            <strong>Age:</strong> {patientData.patient.age}
          </p>
          <p>
            <strong>Gender:</strong> {patientData.patient.gender}
          </p>
          <p>
            <strong>Blood Group:</strong> {patientData.patient.bloodGroup}
          </p>
          <p>
            <strong>Medical History:</strong>{" "}
            {patientData.patient.medicalHistory}
          </p>

          <h4>EHR History</h4>
          {patientData.ehrHistory && patientData.ehrHistory.length > 0 ? (
            patientData.ehrHistory.map((ehr, index) => (
              <div key={ehr._id} className="ehr-record">
                <h5>
                  Record {index + 1} (
                  {new Date(ehr.timestamp).toLocaleDateString()})
                </h5>
                <p>
                  <strong>Symptoms:</strong> {ehr.symptoms.join(", ")}
                </p>
                <p>
                  <strong>EHR Details:</strong> {ehr.ehr}
                </p>
                <p>
                  <strong>Medicines:</strong> {ehr.medicines.join(", ")}
                </p>
                <p>
                  <strong>Prescription:</strong> {ehr.prescription}
                </p>
                <p>
                  <strong>Predicted Disease:</strong> {ehr.predictedDisease}{" "}
                  (Confidence: {ehr.confidence})
                </p>
                <p>
                  <strong>AI Insights:</strong> {ehr.aiInsights}
                </p>
              </div>
            ))
          ) : (
            <p>No EHR history available.</p>
          )}
          <button
            onClick={() => handleGenerateQrCode(patientData.patient._id)}
            className="generate-qr-button"
          >
            Generate Patient QR Code
          </button>
          {qrCodeImage && (
            <img
              src={qrCodeImage}
              alt="Patient QR Code"
              className="qr-code-image"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
