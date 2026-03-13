import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../../components/UploadPrescription/Sidebar";
import { getPrescriptionDetails } from "../../api/prescriptionApi";
import "./PrescriptionDetails.css";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 30; // ~75 seconds

const PrescriptionDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prescriptionId = location.state?.prescriptionId;
  const medicinesFromState = location.state?.medicines;

  const [medicines, setMedicines] = useState(medicinesFromState ?? []);
  const [loading, setLoading] = useState(!!prescriptionId && !medicinesFromState?.length);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!prescriptionId || medicinesFromState?.length) {
      if (medicinesFromState?.length) setMedicines(medicinesFromState);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let intervalId = null;

    const fetchDetails = async () => {
      try {
        const data = await getPrescriptionDetails(prescriptionId);
        if (cancelled) return;
        const list = data.medicines ?? [];
        setMedicines(list);
        if (list.length > 0) {
          setLoading(false);
          setLoadError(null);
          return true;
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.response?.data?.error || "Failed to load prescription details");
        setLoading(false);
        return false;
      }
      return false;
    };

    (async () => {
      const gotMedicines = await fetchDetails();
      if (gotMedicines || cancelled) return;

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
    navigate("/search", { state: { medicine: medicineName, prescriptionId } });
  };

  return (
    <div className="prescription-details-page">
      <Sidebar />

      <div className="prescription-details-content">
        <h1 className="prescription-details-title">Extracted Medicines</h1>

        {loading && (
          <div className="prescription-details-loading">
            <p>Analyzing prescription…</p>
            <progress
              style={{ width: "300px", height: "12px", marginTop: "10px" }}
            />
          </div>
        )}
        {loadError && !loading && (
          <p className="prescription-details-error">{loadError}</p>
        )}
        {!loading && medicines.length === 0 && !loadError ? (
          <p className="prescription-details-empty">No medicines extracted.</p>
        ) : !loading && medicines.length > 0 ? (
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
                  <tr key={index}>
                    <td>{med.medicine_name}</td>
                    <td>{med.dosage ?? "—"}</td>
                    <td>{med.frequency ?? "—"}</td>
                    <td>{med.duration ?? "—"}</td>
                    <td>{(med.confidence != null ? med.confidence * 100 : 0).toFixed(0)}%</td>
                    <td>
                      <button
                        type="button"
                        className="compare-salt-btn"
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
        ) : null}
      </div>
    </div>
  );
};

export default PrescriptionDetails;
