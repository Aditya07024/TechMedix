import React, { useState, useEffect } from "react";
import axios from "axios";

export default function PrescriptionView({ patientId }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPrescriptions();
  }, [patientId]);

  const fetchPrescriptions = async () => {
    try {
      const response = await axios.get(
        `/api/v2/prescriptions/patient/${patientId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setPrescriptions(response.data.data || []);
    } catch (err) {
      setError("Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  };

  const requestRefill = async (prescriptionId) => {
    try {
      await axios.post(
        `/api/v2/prescriptions/${prescriptionId}/refill`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      alert("Refill requested! Doctor will review shortly.");
      fetchPrescriptions();
    } catch (error) {
      alert("Failed to request refill: " + error.response?.data?.error);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: "success",
      expired: "danger",
      completed: "secondary",
    };
    return colors[status] || "info";
  };

  if (loading) return <div>Loading prescriptions...</div>;

  return (
    <div className="prescription-view">
      <h2>My Prescriptions</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {prescriptions.length === 0 ? (
        <p className="empty-state">No prescriptions yet</p>
      ) : (
        <div className="prescription-list">
          {prescriptions.map((prescription) => (
            <div key={prescription.id} className="prescription-card">
              <div className="prescription-header">
                <h4>{prescription.medicine_name}</h4>
                <span
                  className={`badge badge-${getStatusBadge(prescription.status)}`}
                >
                  {prescription.status.toUpperCase()}
                </span>
              </div>

              <div className="prescription-details">
                <p>
                  <strong>Dosage:</strong> {prescription.dosage}
                </p>
                <p>
                  <strong>Frequency:</strong> {prescription.frequency}
                </p>
                <p>
                  <strong>Duration:</strong> {prescription.duration_days} days
                </p>
                <p>
                  <strong>Doctor:</strong> Dr. {prescription.doctor_name}
                </p>
                <p>
                  <strong>Prescribed:</strong>{" "}
                  {new Date(prescription.created_at).toLocaleDateString()}
                </p>
                {prescription.expires_at && (
                  <p>
                    <strong>Expires:</strong>{" "}
                    {new Date(prescription.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="prescription-actions">
                {prescription.status === "active" &&
                  prescription.refill_count < prescription.max_refills && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => requestRefill(prescription.id)}
                    >
                      Request Refill
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
