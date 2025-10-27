// filepath: src/pages/DoctorDashboard/DoctorDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { doctorApi, patientDataApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import * as XLSX from "xlsx";
import "./DoctorDashboard.css";

const DoctorDashboard = () => {
  const [uniqueCode, setUniqueCode] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const { user } = useAuth();

  const scannerRef = useRef(null);

  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    if (["string", "number", "boolean"].includes(typeof value)) return value.toString();
    if (Array.isArray(value)) return value.length ? value.join(", ") : "N/A";
    if (typeof value === "object") {
      const parts = Object.entries(value).map(([k, v]) =>
        typeof v === "object" ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`
      );
      return parts.length ? parts.join(", ") : "N/A";
    }
    return String(value);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    setError("");
    setPatientData(null);
    setQrCodeImage("");
    setLoading(true);

    try {
      const res = await doctorApi.getPatientData(uniqueCode);
      setPatientData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to fetch patient data");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQrCode = async (patientId) => {
    setError("");
    setQrCodeImage("");
    setLoading(true);

    try {
      const res = await patientDataApi.generatePatientQR(patientId);
      setQrCodeImage(res.data.qr);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (decodedText) => {
    setScannedText(decodedText || "");
    setScanning(false);

    const uniqueCodeFromQR = decodedText?.trim();
    if (!uniqueCodeFromQR) {
      setError("Invalid QR code scanned.");
      return;
    }

    setUniqueCode(uniqueCodeFromQR);
    setError("");
    setPatientData(null);
    setLoading(true);

    try {
      const res = await doctorApi.getPatientData(uniqueCodeFromQR);
      setPatientData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to fetch patient data after scan");
    } finally {
      setLoading(false);
    }
  };

  const handleScanError = (err) => console.warn("QR scan warning:", err);

  useEffect(() => {
    let mounted = true;
    if (!scanning) {
      scannerRef.current?.clear().catch(console.error).finally(() => {
        scannerRef.current = null;
      });
      return;
    }

    (async () => {
      try {
        setError("");
        setPatientData(null);
        setQrCodeImage("");
        setScannedText("");

        const module = await import("html5-qrcode");
        const Html5QrcodeScanner = module.Html5QrcodeScanner;
        const Html5QrcodeScanType = module.Html5QrcodeScanType;

        if (!mounted || !scanning) return;

        const scannerId = "qr-reader";
        const container = document.getElementById(scannerId);
        if (!container) {
          setError("QR reader container not available.");
          setScanning(false);
          return;
        }

        scannerRef.current = new Html5QrcodeScanner(
          scannerId,
          {
            fps: 10,
            qrbox: { width: 300, height: 300 },
            supportedScanTypes: Html5QrcodeScanType
              ? [Html5QrcodeScanType.SCAN_TYPE_QR_CODE]
              : undefined,
          },
          false
        );

        scannerRef.current.render(
          (decodedText) => handleScanSuccess(decodedText),
          handleScanError
        );
      } catch (err) {
        console.error("Failed to start QR scanner:", err);
        setError("QR scanner failed to start. Allow camera permission and retry.");
        setScanning(false);
      }
    })();

    return () => {
      mounted = false;
      scannerRef.current?.clear().catch(console.error).finally(() => {
        scannerRef.current = null;
      });
    };
  }, [scanning]);

  const exportToExcel = () => {
    if (!patientData?.patient) return setError("No patient data to export");

    try {
      const excelData = [];
      const p = patientData.patient;

      excelData.push(
        { Category: "Patient Info", Field: "Name", Value: p.name },
        { Category: "Patient Info", Field: "Age", Value: p.age },
        { Category: "Patient Info", Field: "Gender", Value: p.gender },
        { Category: "Patient Info", Field: "Blood Group", Value: p.bloodGroup },
        { Category: "Patient Info", Field: "Medical History", Value: formatValue(p.medicalHistory) },
        { Category: "Patient Info", Field: "Unique Code", Value: uniqueCode },
        {}
      );

      (patientData.ehrHistory || []).forEach((ehr, i) => {
        excelData.push(
          { Category: `EHR ${i + 1}`, Field: "Timestamp", Value: new Date(ehr.timestamp).toLocaleString() },
          { Category: `EHR ${i + 1}`, Field: "Symptoms", Value: formatValue(ehr.symptoms) },
          { Category: `EHR ${i + 1}`, Field: "Predicted Disease", Value: formatValue(ehr.predictedDisease) },
          { Category: `EHR ${i + 1}`, Field: "Confidence", Value: formatValue(ehr.confidence) },
          { Category: `EHR ${i + 1}`, Field: "AI Insights", Value: formatValue(ehr.aiInsights) },
          {}
        );
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, "Patient Data");
      XLSX.writeFile(wb, `patient_data_${p.name || "unknown"}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      setError("Failed to export to Excel");
    }
  };

  if (!user || user.role !== "doctor") {
    return <div className="doctor-dashboard-container">Unauthorized access. Please log in as a doctor.</div>;
  }

  return (
    <div className="doctor-dashboard-container">
      <h2>Welcome, Dr. {formatValue(user?.name)}</h2>

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
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search Patient"}
          </button>
        </form>

        <button
          onClick={() => {
            setScanning((s) => !s);
            setPatientData(null);
            setUniqueCode("");
            setError("");
          }}
          className="scan-qr-button"
        >
          {scanning ? "Stop Scanning" : "Scan QR Code"}
        </button>

        {error && <p className="error-message">{error}</p>}
      </div>

      {scanning && (
        <div className="qr-scanner-container">
          <h3>Scan Patient QR Code</h3>
          <div id="qr-reader" style={{ width: "100%" }} />
          <p>Aim camera at patient’s QR code. It will stop automatically when detected.</p>
          <button onClick={() => setScanning(false)} className="cancel-scan-button">Cancel</button>
        </div>
      )}

      {scannedText && (
        <div style={{ marginTop: 12 }}>
          <strong>Last scanned:</strong> <span>{scannedText}</span>
        </div>
      )}

      {patientData?.patient && (
        <div className="patient-data-display">
          <div className="patient-actions">
            <button onClick={exportToExcel} className="export-excel-button">Export to Excel</button>
            <button
              onClick={() => handleGenerateQrCode(patientData.patient._id)}
              className="generate-qr-button"
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Data QR Code"}
            </button>
          </div>

          <h3>Patient Information</h3>
          <p><strong>Unique Code:</strong> {uniqueCode}</p>
          <p><strong>Name:</strong> {formatValue(patientData.patient.name)}</p>
          <p><strong>Email:</strong> {formatValue(patientData.patient.email)}</p>
          <p><strong>Age:</strong> {formatValue(patientData.patient.age)}</p>
          <p><strong>Gender:</strong> {formatValue(patientData.patient.gender)}</p>
          <p><strong>Blood Group:</strong> {formatValue(patientData.patient.bloodGroup)}</p>
          <p><strong>Medical History:</strong> {formatValue(patientData.patient.medicalHistory)}</p>

          <h4>EHR History ({patientData.ehrHistory?.length || 0} records)</h4>
          {patientData.ehrHistory?.length ? (
            patientData.ehrHistory.map((ehr, i) => (
              <div key={ehr._id || i} className="ehr-record">
                <h5>Record {i + 1} ({new Date(ehr.timestamp).toLocaleDateString()})</h5>
                <p><strong>Symptoms:</strong> {formatValue(ehr.symptoms)}</p>
                <p><strong>Predicted Disease:</strong> {formatValue(ehr.predictedDisease)} (Confidence: {formatValue(ehr.confidence)})</p>
                <p><strong>AI Insights:</strong> {formatValue(ehr.aiInsights)}</p>
              </div>
            ))
          ) : (
            <p>No EHR history available.</p>
          )}

          {qrCodeImage && (
            <div className="qr-code-section">
              <h4>Patient Data QR Code</h4>
              <p><em>This QR contains all patient data and can be scanned by other doctors.</em></p>
              <img src={qrCodeImage} alt="Patient Data QR Code" className="qr-code-image" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
