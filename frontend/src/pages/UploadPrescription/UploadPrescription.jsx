import React, { useState } from "react";
import { uploadPrescription } from "../../api/prescriptionApi";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import "./UploadPrescription.css";

const UploadPrescription = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ✅ GET LOGGED-IN USER
  const user = JSON.parse(localStorage.getItem("user"));

  const handleUpload = async () => {
    if (!file) {
      setError("Please upload a prescription file");
      return;
    }

    if (!user?.id) {
      setError("User not logged in");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await uploadPrescription(
        file,
        user.id,
        user.patientId || user.id
      );

      navigate("/prescription-details", {
        state: {
          prescriptionId: data.prescription_id,
        },
      });
    } catch (err) {
      console.error(err);
      setError("Failed to analyze prescription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <Sidebar active="upload" />

      <div className="upload-content">
        <h1 className="upload-title">Upload Prescription</h1>

        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="upload-input"
        />

        <button
          onClick={handleUpload}
          className="upload-btn"
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze Prescription"}
        </button>

        {error && <p className="upload-error">{error}</p>}
      </div>
    </div>
  );
};

export default UploadPrescription;
