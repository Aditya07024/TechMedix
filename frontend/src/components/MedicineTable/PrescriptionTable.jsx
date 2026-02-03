import React from "react";

export default function PrescriptionTable({ prescriptions = [], onCompare }) {
  return (
    <div className="prescription-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Prescription (image / text)</th>
            <th>Medicines</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {prescriptions.length === 0 ? (
            <tr>
              <td colSpan="5">No prescriptions found.</td>
            </tr>
          ) : (
            prescriptions.map((p) => (
              <tr key={p.id || p._id}>
                <td>{new Date(p.createdAt || p.date || p.uploadedAt).toLocaleString()}</td>
                <td>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="prescription" style={{width:80, height:"auto"}} />
                  ) : (
                    <pre style={{whiteSpace:"pre-wrap"}}>{p.rawText || p.extractedText || "-"}</pre>
                  )}
                </td>
                <td>
                  {(p.medicines || []).map((m, i) => (
                    <div key={i}>
                      {m.name || m.medicineName} {m.dosage ? `- ${m.dosage}` : ""}
                    </div>
                  ))}
                </td>
                <td>{p.notes || "-"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onCompare && onCompare(p)}
                    className="compare-salt-btn"
                  >
                    Compare with salt
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}