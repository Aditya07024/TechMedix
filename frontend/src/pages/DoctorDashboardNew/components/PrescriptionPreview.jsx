import React from 'react';
import { Printer } from 'lucide-react';

const PrescriptionPreview = ({ doctor, patient, medicines, diagnosis, notes, rxNumber }) => {
  const doctorName = doctor?.name || "Dr. Ashish Thakur";
  const qualification = "MBBS, MD";
  const date = new Date().toLocaleDateString();

  return (
    <div className="prescription-preview-shell">
      <div className="preview-header">
        <span>Live Preview</span>
        <button className="print-btn" onClick={() => window.print()}>
          <Printer size={16} />
          Print
        </button>
      </div>
      
      <div className="prescription-paper">
        <header className="paper-header">
          <div className="clinic-info">
            <div className="clinic-logo">
              <div className="logo-placeholder">TM</div>
              <div>
                <h2>TechMedix Clinic</h2>
                <p>Health & Wellness Center</p>
              </div>
            </div>
            <div className="doctor-contact">
              <strong>{doctorName}</strong>
              <p>{qualification}</p>
              <p>Reg No: DMC/12345</p>
            </div>
          </div>
        </header>

        <div className="patient-strip">
          <div className="patient-meta">
            <span><strong>Patient:</strong> {patient?.name || "Guest Patient"}</span>
            <span><strong>Age/Sex:</strong> {patient?.age || "N/A"} / {patient?.gender || "N/A"}</span>
          </div>
          <div className="rx-meta">
            <span><strong>Date:</strong> {date}</span>
            <span><strong>Rx No:</strong> {rxNumber}</span>
          </div>
        </div>

        <div className="paper-body">
          {diagnosis && (
            <div className="diagnosis-section">
              <h3>Diagnosis</h3>
              <p>{diagnosis}</p>
            </div>
          )}

          <div className="rx-symbol">Rx</div>

          <div className="medicine-list-paper">
            {medicines.length === 0 ? (
              <p className="empty-rx">No medicines added yet.</p>
            ) : (
              medicines.map((med, index) => (
                <div key={index} className="med-row-paper">
                  <div className="med-main">
                    <strong>{index + 1}. {med.medicine_name}</strong>
                    <span className="med-dosage">{med.dosage}</span>
                  </div>
                  <div className="med-details-paper">
                    <span>{med.frequency}</span>
                    <span>For {med.duration}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {notes && (
            <div className="notes-section">
              <h3>Additional Instructions</h3>
              <p>{notes}</p>
            </div>
          )}
        </div>

        <footer className="paper-footer">
          <div className="signature-area">
            <div className="signature-line"></div>
            <p>Doctor's Signature</p>
          </div>
          <div className="clinic-footer">
            <p>123, Wellness Block, MG Road, Bangalore - 560001</p>
            <p>Tel: +91 98765 43210 | www.techmedix.com</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrescriptionPreview;
