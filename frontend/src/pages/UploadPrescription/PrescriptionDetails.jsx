import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  FileText,
  Pill,
  RefreshCcw,
  Search,
} from "lucide-react";
import Sidebar from "../../components/UploadPrescription/Sidebar";
import { getPrescriptionDetails } from "../../api/prescriptionApi";
import "./PrescriptionDetails.css";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 30;

const normalizeMedicine = (medicine) => ({
  ...medicine,
  medicine_name: medicine?.medicine_name || "",
  dosage: medicine?.dosage || "—",
  frequency: medicine?.frequency || "—",
  duration: medicine?.duration || "—",
  confidence: Number.isFinite(Number(medicine?.confidence))
    ? Number(medicine.confidence)
    : null,
});

const PrescriptionDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prescriptionId = location.state?.prescriptionId;
  const medicinesFromState = location.state?.medicines;

  const [medicines, setMedicines] = useState(
    Array.isArray(medicinesFromState) ? medicinesFromState.map(normalizeMedicine) : [],
  );
  const [loading, setLoading] = useState(!!prescriptionId && !medicinesFromState?.length);
  const [loadError, setLoadError] = useState(null);
  const [prescriptionStatus, setPrescriptionStatus] = useState(
    medicinesFromState?.length ? "visited" : "processing",
  );
  const [manualReviewRequired, setManualReviewRequired] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [processInfo, setProcessInfo] = useState({
    uploaded: Boolean(prescriptionId),
    ocr_completed: false,
    extraction_running: false,
    extraction_completed: false,
    medicines_detected: Array.isArray(medicinesFromState) ? medicinesFromState.length : 0,
    current_status: medicinesFromState?.length ? "visited" : "processing",
  });

  useEffect(() => {
    if (!prescriptionId || medicinesFromState?.length) {
      if (medicinesFromState?.length) {
        setMedicines(medicinesFromState.map(normalizeMedicine));
      }
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let intervalId = null;

    const fetchDetails = async () => {
      try {
        const data = await getPrescriptionDetails(prescriptionId);
        if (cancelled) return false;

        const nextMedicines = Array.isArray(data?.medicines)
          ? data.medicines.map(normalizeMedicine)
          : [];
        const nextStatus = data?.prescription?.status || "processing";
        const requiresManualReview = Boolean(data?.manual_review_required);

        setMedicines(nextMedicines);
        setPrescriptionStatus(nextStatus);
        setManualReviewRequired(requiresManualReview);
        setExtractedText(data?.prescription?.extracted_text || "");
        setProcessInfo(
          data?.process || {
            uploaded: true,
            ocr_completed: Boolean(data?.prescription?.extracted_text),
            extraction_running: nextStatus === "extracting" || nextStatus === "ocr_complete",
            extraction_completed: nextStatus === "visited" || nextStatus === "manual_review",
            medicines_detected: nextMedicines.length,
            current_status: nextStatus,
          },
        );
        setLoadError(null);

        if (nextMedicines.length > 0 || requiresManualReview || nextStatus === "failed") {
          setLoading(false);
          if (nextStatus === "failed") {
            setLoadError("Prescription analysis failed. Please upload again.");
          }
          return true;
        }
      } catch (err) {
        if (cancelled) return false;
        setLoadError(err.response?.data?.error || "Failed to load prescription details");
        setLoading(false);
        return true;
      }

      return false;
    };

    (async () => {
      const resolved = await fetchDetails();
      if (resolved || cancelled) return;

      intervalId = setInterval(async () => {
        attempts += 1;
        if (cancelled || attempts > MAX_POLL_ATTEMPTS) {
          if (intervalId) clearInterval(intervalId);
          if (!cancelled && attempts > MAX_POLL_ATTEMPTS) {
            setLoading(false);
            setLoadError("Analysis is taking longer than usual. Please refresh in a moment.");
          }
          return;
        }

        const done = await fetchDetails();
        if (done && intervalId) clearInterval(intervalId);
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [prescriptionId, medicinesFromState]);

  const handleCompareWithSalt = (medicineName) => {
    navigate("/search", {
      state: {
        medicine: medicineName,
        compareBySalt: true,
        prescriptionId,
      },
    });
  };

  const averageConfidence = useMemo(() => {
    const validConfidence = medicines
      .map((medicine) => medicine.confidence)
      .filter((confidence) => typeof confidence === "number");

    if (!validConfidence.length) return null;
    return Math.round(
      (validConfidence.reduce((sum, confidence) => sum + confidence, 0) /
        validConfidence.length) *
        100,
    );
  }, [medicines]);

  const hasResults = medicines.length > 0;
  const processSteps = [
    {
      id: "uploaded",
      label: "Prescription uploaded",
      detail: "File received and queued for analysis.",
      state: processInfo.uploaded ? "done" : "pending",
    },
    {
      id: "ocr",
      label: "OCR completed",
      detail: processInfo.ocr_completed
        ? "Text was extracted from the uploaded document."
        : "We are still reading the prescription image.",
      state: processInfo.ocr_completed ? "done" : "pending",
    },
    {
      id: "extraction",
      label: "Medicine extraction",
      detail:
        processInfo.extraction_completed || hasResults
          ? `Structured extraction finished with ${processInfo.medicines_detected || medicines.length} medicine result${(processInfo.medicines_detected || medicines.length) === 1 ? "" : "s"}.`
          : processInfo.extraction_running
            ? "Matching OCR text with medicine names and dosage patterns."
            : "Waiting for extraction to start.",
      state:
        processInfo.extraction_completed || hasResults
          ? "done"
          : processInfo.extraction_running
            ? "active"
            : "pending",
    },
    {
      id: "review",
      label: "Final review",
      detail: manualReviewRequired
        ? "Automatic extraction needs manual verification."
        : hasResults
          ? "Results are ready to review and compare."
          : loading
            ? "Final validation is still in progress."
            : "Awaiting final result.",
      state: manualReviewRequired || hasResults ? "done" : loading ? "active" : "pending",
    },
  ];

  return (
    <div className="prescription-details-page">
      <Sidebar active="details" />

      <div className="prescription-details-content">
        <section className="prescription-hero-card">
          <div>
            <p className="prescription-kicker">Prescription Intelligence</p>
            <h1 className="prescription-details-title">Extracted medicines</h1>
            <p className="prescription-subtitle">
              Review OCR extraction results, compare salts, and catch prescriptions that
              need manual verification.
            </p>
          </div>
          <div
            className={`prescription-status-badge ${
              loading
                ? "processing"
                : manualReviewRequired
                  ? "manual"
                  : hasResults
                    ? "success"
                    : "idle"
            }`}
          >
            {loading ? (
              <>
                <RefreshCcw size={16} strokeWidth={2} />
                <span>Analyzing</span>
              </>
            ) : manualReviewRequired ? (
              <>
                <AlertTriangle size={16} strokeWidth={2} />
                <span>Manual review</span>
              </>
            ) : hasResults ? (
              <>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Extraction ready</span>
              </>
            ) : (
              <>
                <FileSearch size={16} strokeWidth={2} />
                <span>No extraction</span>
              </>
            )}
          </div>
        </section>

        <section className="prescription-summary-grid">
          <div className="prescription-summary-card">
            <span className="summary-label">Prescription ID</span>
            <strong>{prescriptionId || "Not available"}</strong>
          </div>
          <div className="prescription-summary-card">
            <span className="summary-label">Detected medicines</span>
            <strong>{hasResults ? medicines.length : 0}</strong>
          </div>
          <div className="prescription-summary-card">
            <span className="summary-label">Average confidence</span>
            <strong>{averageConfidence != null ? `${averageConfidence}%` : "—"}</strong>
          </div>
          <div className="prescription-summary-card">
            <span className="summary-label">Analysis status</span>
            <strong>{prescriptionStatus || "processing"}</strong>
          </div>
        </section>

        <section className="prescription-process-card">
          <div className="prescription-process-header">
            <div>
              <h2>Live processing status</h2>
              <p>We show each stage so you can see what is finished and what is still left.</p>
            </div>
            <span className="process-status-chip">
              <Clock3 size={15} strokeWidth={2} />
              <span>{processInfo.current_status || "processing"}</span>
            </span>
          </div>
          <div className="prescription-process-steps">
            {processSteps.map((step) => (
              <div key={step.id} className={`process-step-card ${step.state}`}>
                <div className="process-step-dot" />
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {loading && (
          <section className="prescription-state-card processing-card">
            <div className="processing-spinner" />
            <div>
              <h2>Analyzing prescription...</h2>
              <p>
                OCR and medicine extraction are still running. This page will refresh
                automatically when the backend finishes.
              </p>
            </div>
          </section>
        )}

        {loadError && !loading && (
          <section className="prescription-state-card error-card">
            <AlertTriangle size={20} strokeWidth={2} />
            <div>
              <h2>Could not load prescription details</h2>
              <p>{loadError}</p>
            </div>
          </section>
        )}

        {!loading && manualReviewRequired && !hasResults && !loadError && (
          <section className="prescription-state-card manual-review-card">
            <div className="manual-review-icon">
              <FileSearch size={24} strokeWidth={2} />
            </div>
            <div>
              <h2>Manual review required</h2>
              <p>
                OCR completed, but no reliable medicine names were extracted from this
                prescription. Re-upload a clearer image or review the scan manually.
              </p>
            </div>
          </section>
        )}

        {!loading && hasResults && !loadError && (
          <section className="prescription-results-card">
            <div className="prescription-results-header">
              <div>
                <h2>Detected medicines</h2>
                <p>Use salt comparison to inspect alternatives medicine by medicine.</p>
              </div>
            </div>

            <div className="prescription-results-list">
              {medicines.map((medicine, index) => (
                <article key={`${medicine.medicine_name}-${index}`} className="prescription-medicine-card">
                  <div className="prescription-medicine-main">
                    <div className="prescription-medicine-icon">
                      <Pill size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <h3>{medicine.medicine_name}</h3>
                      <p>
                        Dosage {medicine.dosage} • Frequency {medicine.frequency} • Duration{" "}
                        {medicine.duration}
                      </p>
                    </div>
                  </div>
                  <div className="prescription-medicine-side">
                    <span className="confidence-pill">
                      {medicine.confidence != null
                        ? `${Math.round(medicine.confidence * 100)}% confidence`
                        : "Confidence unavailable"}
                    </span>
                    <button
                      type="button"
                      className="compare-salt-btn"
                      onClick={() => handleCompareWithSalt(medicine.medicine_name)}
                    >
                      <Search size={15} strokeWidth={2} />
                      <span>Compare with salt</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="prescription-details-table-wrap">
              <table className="prescription-details-table">
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((med, index) => (
                    <tr key={`${med.medicine_name}-${index}`}>
                      <td>{med.medicine_name}</td>
                      <td>{med.dosage}</td>
                      <td>{med.frequency}</td>
                      <td>{med.duration}</td>
                      <td>{med.confidence != null ? `${Math.round(med.confidence * 100)}%` : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="compare-salt-btn compact"
                          onClick={() => handleCompareWithSalt(med.medicine_name)}
                        >
                          Compare with salt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && !hasResults && !manualReviewRequired && !loadError && (
          <section className="prescription-state-card empty-card">
            <FileText size={20} strokeWidth={2} />
            <div>
              <h2>No medicines extracted</h2>
              <p>This prescription does not have any extracted medicines yet.</p>
            </div>
          </section>
        )}

        {!!extractedText && (
          <section className="ocr-preview-card">
            <div className="ocr-preview-header">
              <h2>OCR text preview</h2>
              <p>Shared here so users can see that OCR is complete and what text was detected.</p>
            </div>
            <pre>{extractedText}</pre>
          </section>
        )}
      </div>
    </div>
  );
};

export default PrescriptionDetails;
