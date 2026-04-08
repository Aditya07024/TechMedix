import React, { useState } from "react";
import { uploadPrescription } from "../../api/prescriptionApi";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { FileText, ShieldCheck, UploadCloud } from "lucide-react";
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
        <div className="upload-hero">
          <div>
            <p className="upload-kicker">Prescription Intelligence</p>
            <h1 className="upload-title">Upload and extract medicines in one step</h1>
            <p className="upload-subtitle">
              Add a prescription image or PDF. TechMedix will extract medicine names,
              dosage details, and comparison-ready results for review.
            </p>
          </div>
          <div className="upload-hero-badge">
            <ShieldCheck size={18} strokeWidth={2} />
            <span>Secure patient processing</span>
          </div>
        </div>

        <div className="upload-card">
          <label className="upload-dropzone">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="upload-input"
            />
            <span className="upload-dropzone-icon">
              <UploadCloud size={30} strokeWidth={2} />
            </span>
            <strong>{file ? file.name : "Drop your prescription here or browse files"}</strong>
            <span>Supports JPG, PNG, and PDF documents.</span>
          </label>

          <div className="upload-actions">
            <button
              onClick={handleUpload}
              className="upload-btn"
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Prescription"}
            </button>
            {file ? (
              <div className="upload-file-pill">
                <FileText size={16} strokeWidth={2} />
                <span>{file.name}</span>
              </div>
            ) : null}
          </div>

          {error && <p className="upload-error">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default UploadPrescription;
