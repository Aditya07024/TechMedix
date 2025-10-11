import React, { useState, useEffect } from "react";
import { doctorApi, patientDataApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import * as XLSX from "xlsx"; // Add this import for Excel export
import "./DoctorDashboard.css";

const DoctorDashboard = () => {
  const [uniqueCode, setUniqueCode] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Handle search manually via unique code
  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setPatientData(null);
    setQrCodeImage("");
    setLoading(true);

    try {
      const res = await doctorApi.getPatientData(uniqueCode);
      setPatientData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch patient data");
    } finally {
      setLoading(false);
    }
  };

  // Generate QR Code for patient with all data
  const handleGenerateQrCode = async (patientId) => {
    setError("");
    setQrCodeImage("");
    setLoading(true);

    try {
      const res = await patientDataApi.generatePatientQR(patientId);
      setQrCodeImage(res.data.qr);
      // Store the patient data for potential export
      if (patientData) {
        localStorage.setItem(
          `patientData_${patientId}`,
          JSON.stringify(patientData)
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  // Handle successful QR scan and process the data
  const handleScanSuccess = async (decodedText) => {
    if (!decodedText) return;
    setScanning(false);

    console.log("QR Scanner: Raw decodedText length:", decodedText.length);

    try {
      // Try to parse as JSON (new format with complete data)
      let scannedData;
      try {
        scannedData = JSON.parse(decodedText);
        console.log("QR Scanner: Parsed complete patient data");

        // Set the patient data directly from QR code
        setPatientData({
          patient: scannedData.patientInfo,
          ehrHistory: scannedData.ehrHistory,
        });

        // Store the complete data for export
        localStorage.setItem(
          `scannedPatientData_${scannedData.patientInfo.uniqueCode}`,
          decodedText
        );

        setError("");
        return;
      } catch {
        console.log("Not JSON format, trying URL format...");
      }

      // If not JSON, try URL format (old format)
      if (decodedText.includes("/api/public/patient-history/")) {
        const urlParts = decodedText.split("/");
        const uniqueCodeFromUrl = urlParts[urlParts.length - 1];

        if (uniqueCodeFromUrl) {
          setUniqueCode(uniqueCodeFromUrl);
          setLoading(true);
          try {
            const res = await doctorApi.getPatientData(uniqueCodeFromUrl);
            setPatientData(res.data);
            setError("");
          } catch (err) {
            setError(
              err.response?.data?.message ||
                "Failed to fetch patient data after scan"
            );
          } finally {
            setLoading(false);
          }
        }
      } else {
        setError("Unsupported QR code format");
      }
    } catch (parseError) {
      console.error("QR Parse Error:", parseError);
      setError("Error reading QR code data");
    }
  };

  // Export patient data to Excel
  const exportToExcel = () => {
    if (!patientData) {
      setError("No patient data to export");
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = [];

      // Add patient information
      excelData.push({
        Category: "Patient Information",
        Field: "Name",
        Value: patientData.patient.name,
      });
      excelData.push({
        Category: "Patient Information",
        Field: "Age",
        Value: patientData.patient.age,
      });
      excelData.push({
        Category: "Patient Information",
        Field: "Gender",
        Value: patientData.patient.gender,
      });
      excelData.push({
        Category: "Patient Information",
        Field: "Blood Group",
        Value: patientData.patient.bloodGroup,
      });
      excelData.push({
        Category: "Patient Information",
        Field: "Medical History",
        Value: patientData.patient.medicalHistory,
      });

      // Add EHR records
      patientData.ehrHistory?.forEach((ehr, index) => {
        excelData.push({
          Category: `EHR Record ${index + 1}`,
          Field: "Timestamp",
          Value: new Date(ehr.timestamp).toLocaleString(),
        });

        excelData.push({
          Category: `EHR Record ${index + 1}`,
          Field: "Symptoms",
          Value: Array.isArray(ehr.symptoms)
            ? ehr.symptoms.join(", ")
            : ehr.symptoms,
        });

        excelData.push({
          Category: `EHR Record ${index + 1}`,
          Field: "Predicted Disease",
          Value: ehr.predictedDisease,
        });

        excelData.push({
          Category: `EHR Record ${index + 1}`,
          Field: "Confidence",
          Value: ehr.confidence,
        });

        excelData.push({
          Category: `EHR Record ${index + 1}`,
          Field: "AI Insights",
          Value: ehr.aiInsights,
        });

        // Add EHR details
        if (ehr.ehr && typeof ehr.ehr === "object") {
          Object.entries(ehr.ehr).forEach(([key, value]) => {
            excelData.push({
              Category: `EHR Record ${index + 1}`,
              Field: key,
              Value: typeof value === "object" ? JSON.stringify(value) : value,
            });
          });
        }

        // Add medicines
        if (Array.isArray(ehr.medicines) && ehr.medicines.length > 0) {
          ehr.medicines.forEach((med, medIndex) => {
            excelData.push({
              Category: `EHR Record ${index + 1} - Medicines`,
              Field: `Medicine ${medIndex + 1}`,
              Value: `${med.name} (Dosage: ${med.dosage}, Frequency: ${med.frequency})`,
            });
          });
        }

        excelData.push({}); // Empty row for separation
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Patient Data");

      // Generate Excel file and trigger download
      const fileName = `patient_data_${patientData.patient.name}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (exportError) {
      console.error("Error exporting to Excel:", exportError);
      setError("Failed to export data to Excel");
    }
  };

  // Handle scan error
  const handleScanError = (errorMessage) => {
    console.warn("QR Scan error:", errorMessage);
  };

  // Initialize & cleanup QR scanner
  useEffect(() => {
    let html5QrcodeScanner;

    if (scanning) {
      const scannerId = "qr-reader";
      html5QrcodeScanner = new Html5QrcodeScanner(
        scannerId,
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_QR_CODE],
        },
        false
      );
      html5QrcodeScanner.render(handleScanSuccess, handleScanError);
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner
          .clear()
          .catch((error) =>
            console.error("Failed to clear QR scanner:", error)
          );
      }
    };
  }, [scanning]);

  // Prevent unauthorized access
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
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search Patient"}
          </button>
        </form>

        <button
          onClick={() => setScanning(true)}
          className="scan-qr-button"
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Scan QR Code"}
        </button>

        {error && <p className="error-message">{error}</p>}
      </div>

      {/* QR SCANNER */}
      {scanning && (
        <div className="qr-scanner-container">
          <h3>Scan Patient QR Code</h3>
          <div id="qr-reader" style={{ width: "100%" }}></div>
          <button
            onClick={() => setScanning(false)}
            className="cancel-scan-button"
          >
            Cancel Scan
          </button>
        </div>
      )}

      {/* PATIENT DATA */}
      {patientData?.patient && (
        <div className="patient-data-display">
          <div className="patient-actions">
            <button onClick={exportToExcel} className="export-excel-button">
              Export to Excel
            </button>

            <button
              onClick={() => handleGenerateQrCode(patientData.patient._id)}
              className="generate-qr-button"
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Data QR Code"}
            </button>
          </div>

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

          <h4>EHR History ({patientData.ehrHistory?.length || 0} records)</h4>
          {patientData.ehrHistory?.length > 0 ? (
            patientData.ehrHistory.map((ehr, index) => (
              <div key={ehr._id || index} className="ehr-record">
                <h5>
                  Record {index + 1} (
                  {new Date(ehr.timestamp).toLocaleDateString()})
                </h5>
                <p>
                  <strong>Symptoms:</strong>{" "}
                  {Array.isArray(ehr.symptoms)
                    ? ehr.symptoms.join(", ")
                    : ehr.symptoms || "N/A"}
                </p>
                <p>
                  <strong>Predicted Disease:</strong>{" "}
                  {ehr.predictedDisease || "N/A"} (Confidence:{" "}
                  {ehr.confidence || "N/A"})
                </p>
                <p>
                  <strong>AI Insights:</strong> {ehr.aiInsights || "N/A"}
                </p>
              </div>
            ))
          ) : (
            <p>No EHR history available.</p>
          )}

          {qrCodeImage && (
            <div className="qr-code-section">
              <h4>Patient Data QR Code</h4>
              <p>
                <em>
                  This QR contains all patient data and can be scanned by other
                  doctors
                </em>
              </p>
              <img
                src={qrCodeImage}
                alt="Patient Data QR Code"
                className="qr-code-image"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
