import React from "react";
import { Printer, Download, Wallet, CheckCircle2 } from "lucide-react";
import "./DigitalPrescription.css";

const DigitalPrescription = ({ 
  doctor, 
  patient, 
  medicines = [], 
  diagnosis = "", 
  notes = "", 
  rxNumber = "", 
  isPatientView = false,
  onSaveToWallet = null,
  isSaving = false
}) => {
  const doctorName = doctor?.name || "Practitioner Name";
  const doctorSpecialty = doctor?.specialty || "Medical Consultant";
  const clinicName = "TechMedix Clinical Sanctuary";
  const clinicAddress = "124, Healthcare Boulevard, Medical District";
  const clinicContact = "+91 98765-43210 | support@techmedix.com";
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`digital-prescription-container ${isPatientView ? 'patient-mode' : 'doctor-mode'}`}>
      <div className="preview-header no-print">
        <div className="header-left">
          <CheckCircle2 size={16} className="status-icon" />
          <span>{isPatientView ? "Your Clinical Prescription" : "Live Prescription Preview"}</span>
        </div>
        <div className="header-actions">
          {isPatientView && (
            <button 
              className="wallet-btn" 
              onClick={onSaveToWallet}
              disabled={isSaving}
            >
              <Wallet size={14} />
              {isSaving ? "Saving..." : "Save to Wallet"}
            </button>
          )}
          <button className="print-btn" onClick={handlePrint}>
            <Printer size={14} />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="prescription-paper" id="digital-rx-pad">
        {/* Paper Header */}
        <div className="paper-header">
          <div className="clinic-branding">
            <div className="clinic-logo-box">
              <span>TM</span>
            </div>
            <div className="clinic-info">
              <h2>{clinicName}</h2>
              <p>{clinicAddress}</p>
            </div>
          </div>
          <div className="doctor-info-strip">
            <div className="doc-main">
              <strong>{doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}</strong>
              <span>{doctorSpecialty}</span>
            </div>
            <div className="doc-meta">
              <p>{clinicContact}</p>
              <p>Reg No: TM-DOC-2024-001</p>
            </div>
          </div>
        </div>

        {/* Patient Details */}
        <div className="patient-details-strip">
          <div className="detail-item">
            <label>Patient:</label>
            <strong>{patient?.name || "Walk-in Patient"}</strong>
          </div>
          <div className="detail-item">
            <label>ID:</label>
            <strong>{patient?.id ? `#${String(patient.id).slice(0, 8)}` : "—"}</strong>
          </div>
          <div className="detail-item">
            <label>Date:</label>
            <strong>{new Date().toLocaleDateString()}</strong>
          </div>
          <div className="detail-item">
            <label>Rx No:</label>
            <strong>{rxNumber || "RX-TEMP"}</strong>
          </div>
        </div>

        {/* Body */}
        <div className="paper-body">
          <div className="rx-symbol">Rx</div>
          
          {diagnosis && (
            <div className="section-block">
              <h3>Diagnosis / Clinical Findings</h3>
              <p className="diagnosis-text">{diagnosis}</p>
            </div>
          )}

          <div className="medicine-table-paper">
            <h3>Prescribed Medications</h3>
            <table className="rx-table">
              <thead>
                <tr>
                  <th width="5%">#</th>
                  <th width="40%">Medicine Name</th>
                  <th width="15%">Dosage</th>
                  <th width="20%">Frequency</th>
                  <th width="20%">Duration</th>
                </tr>
              </thead>
              <tbody>
                {medicines.length > 0 ? (
                  medicines.map((med, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className="med-name-wrap">
                          <strong>{med.medicine_name}</strong>
                          {med.salt_name && <small>{med.salt_name}</small>}
                        </div>
                      </td>
                      <td>{med.dosage}</td>
                      <td>{med.frequency}</td>
                      <td>{med.duration}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-row">No medications prescribed yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {notes && (
            <div className="section-block extra-notes-block">
              <h3>Additional Instructions / Advice</h3>
              <p className="notes-text">{notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="paper-footer">
          <div className="footer-top">
            <div className="qr-code-placeholder">
              {/* Optional: Add a real QR here if needed */}
              <div className="qr-box">Rx</div>
              <p>Scan to Verify</p>
            </div>
            <div className="signature-block">
              <div className="sig-line"></div>
              <p>Digital Signature</p>
              <strong>{doctorName}</strong>
            </div>
          </div>
          <div className="footer-bottom">
            <p>This is a digitally generated prescription. It does not require a physical stamp for validation.</p>
            <p className="tm-tagline">TechMedix - Precision in Every Care</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalPrescription;
