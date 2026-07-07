import React from "react";
import { Printer, Wallet, CheckCircle2, Download } from "lucide-react";
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
  isSaving = false,
  onDownload = null,
  isDownloading = false,
  // Customization Props
  themeColor = "#0f6b57",
  fontFamily = "Inter",
  layout = "split",
  showLogo = true,
  // Override Texts Props
  clinicNameOverride = "",
  clinicAddressOverride = "",
  clinicContactOverride = "",
  doctorSpecialtyOverride = "",
  doctorRegNoOverride = "",
  footerTextOverride = ""
}) => {
  const doctorName = doctor?.name || "Specialist Consultant";
  const isDoc = doctorName && !doctorName.toLowerCase().includes("upload");
  
  const clinicName = clinicNameOverride || localStorage.getItem("padClinicName") || "TechMedix Clinical Sanctuary";
  const clinicAddress = clinicAddressOverride || localStorage.getItem("padClinicAddress") || "124, Healthcare Boulevard, Medical District";
  const clinicContact = clinicContactOverride || localStorage.getItem("padClinicContact") || (
    isDoc && (doctor?.phone || doctor?.email)
      ? [doctor.phone, doctor.email].filter(Boolean).join(" | ")
      : "techmedixcare@gmail.com"
  );
  
  const doctorSpecialty = doctorSpecialtyOverride || localStorage.getItem("padDoctorSpecialty") || doctor?.specialty || "Medical Consultant";
  const doctorRegNo = doctorRegNoOverride || localStorage.getItem("padDoctorRegNo") || doctor?.reg_no || "TM-DOC-2024-001";
  const footerText = footerTextOverride || localStorage.getItem("padFooterText") || "This is a digitally generated prescription. It does not require a physical stamp for validation.";
  
  const handlePrint = () => {
    window.print();
  };

  const getGroupKey = (med) => {
    const dateVal = med.created_at || med.extracted_at || new Date();
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatGroupKey = (dateKey) => {
    return new Date(dateKey).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const groupsByDate = medicines.reduce((acc, med) => {
    const key = getGroupKey(med);
    if (!acc[key]) acc[key] = [];
    acc[key].push(med);
    return acc;
  }, {});

  // Sort: active on top, stopped at bottom
  Object.keys(groupsByDate).forEach(key => {
    groupsByDate[key].sort((a, b) => {
      const aDel = a.is_deleted ? 1 : 0;
      const bDel = b.is_deleted ? 1 : 0;
      return aDel - bDel;
    });
  });

  const sortedDateKeys = Object.keys(groupsByDate).sort((a, b) => b.localeCompare(a));
  let globalIdx = 0;

  const containerStyle = {
    "--rx-green": themeColor,
    "--rx-green-soft": themeColor + "15",
    fontFamily: fontFamily === "serif" ? "Georgia, serif" : fontFamily === "mono" ? "Courier New, monospace" : fontFamily === "Outfit" ? "'Outfit', sans-serif" : "'Inter', sans-serif",
  };

  return (
    <div 
      className={`digital-prescription-container ${isPatientView ? 'patient-mode' : 'doctor-mode'}`}
      style={containerStyle}
    >
      <div className="preview-header no-print">
        <div className="header-left">
          <CheckCircle2 size={16} className="status-icon" style={{ color: themeColor }} />
          <span style={{ color: themeColor }}>{isPatientView ? "Your Clinical Prescription" : "Live Prescription Preview"}</span>
        </div>
        <div className="header-actions">
          {isPatientView && (
            <button 
              className="wallet-btn" 
              onClick={onSaveToWallet}
              disabled={isSaving}
              style={{ backgroundColor: themeColor }}
            >
              <Wallet size={14} />
              {isSaving ? "Saving..." : "Save to Wallet"}
            </button>
          )}
          {isPatientView && onDownload && (
            <button 
              className="download-btn-rx" 
              onClick={onDownload}
              disabled={isDownloading}
              style={{ backgroundColor: themeColor + "15", color: themeColor }}
            >
              <Download size={14} />
              {isDownloading ? "Downloading..." : "Download"}
            </button>
          )}
        </div>
      </div>

      <div className="prescription-paper" id="digital-rx-pad">
        {/* Paper Header */}
        <div className="paper-header" style={{
          display: "flex",
          flexDirection: layout === "center" ? "column" : "row",
          alignItems: layout === "center" ? "center" : "flex-start",
          textAlign: layout === "center" ? "center" : "left",
          justifyContent: layout === "split" ? "space-between" : "flex-start",
          gap: "20px",
          borderBottom: `3px solid ${themeColor}`,
          paddingBottom: "25px",
          marginBottom: "30px",
        }}>
          {showLogo ? (
            <div className="clinic-branding" style={{
              flexDirection: layout === "center" ? "column" : "row",
              alignItems: "center",
              textAlign: layout === "center" ? "center" : "left",
              gap: "15px",
            }}>
              <div className="clinic-logo-box" style={{ backgroundColor: themeColor, display: "grid", placeItems: "center", borderRadius: "10px", width: "50px", height: "50px" }}>
                <img src="/image.png" alt="Logo" style={{height:"40px",width:"40px"}}/>
              </div>
              <div className="clinic-info">
                <h2 style={{ color: themeColor, margin: 0, fontSize: "1.4rem", lineHeight: 1.2 }}>{clinicName}</h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--rx-muted)" }}>{clinicAddress}</p>
              </div>
            </div>
          ) : (
            <div className="clinic-info">
              <h2 style={{ color: themeColor, margin: 0, fontSize: "1.4rem", lineHeight: 1.2 }}>{clinicName}</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--rx-muted)" }}>{clinicAddress}</p>
            </div>
          )}
          
          <div className="doctor-info-strip" style={{
            textAlign: layout === "center" ? "center" : layout === "split" ? "right" : "left",
            marginLeft: layout === "left" && !showLogo ? "auto" : "0",
          }}>
            <div className="doc-main">
              <strong>{isDoc ? (doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`) : doctorName}</strong>
              <span style={{ color: themeColor, display: "block", fontSize: "0.85rem", fontWeight: 700, marginTop: "2px" }}>{doctorSpecialty}</span>
            </div>
            <div className="doc-meta" style={{ marginTop: "10px", fontSize: "0.75rem", color: "var(--rx-muted)", lineHeight: 1.4 }}>
              <p>{clinicContact}</p>
              {isDoc && <p>{doctorRegNo}</p>}
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
          {/* <div className="rx-symbol">Rx</div> */}
          
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
                {sortedDateKeys.map((dateKey, groupIdx) => {
                   const meds = groupsByDate[dateKey];
                   const dateStr = formatGroupKey(dateKey);
                   return (
                     <React.Fragment key={dateKey}>
                       <tr className="rx-table-section-header no-print">
                         <td colSpan="5" style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '10px 12px', color: '#334155', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                           Prescribed on: {dateStr}
                         </td>
                       </tr>
                       <tr className="rx-table-section-header print-only-header" style={{ display: 'none' }}>
                         <td colSpan="5" style={{ fontWeight: 'bold', borderTop: '2px solid #0f6b57', padding: '10px 12px 6px', color: '#1a1a1a', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                           Prescribed on: {dateStr}
                         </td>
                       </tr>
                       {meds.map((med, idx) => {
                         globalIdx++;
                         return (
                           <tr key={med.id || `med-${groupIdx}-${idx}`} className={med.is_deleted ? "discontinued-row" : ""}>
                             <td>{globalIdx}</td>
                             <td>
                               <div className="med-name-wrap">
                                 <strong>
                                   {med.medicine_name}
                                   {med.is_deleted && (
                                     <span style={{ color: '#b91c1c', fontSize: '0.7rem', fontWeight: 'normal', marginLeft: '8px', padding: '1px 5px', borderRadius: '4px', background: '#fee2e2', border: '1px solid #fca5a5' }}>
                                       Stopped
                                     </span>
                                   )}
                                 </strong>
                                 {med.salt_name && <small>{med.salt_name}</small>}
                               </div>
                             </td>
                             <td>{med.dosage || "—"}</td>
                             <td>{med.frequency || "—"}</td>
                             <td>{med.duration || "—"}</td>
                           </tr>
                         );
                       })}
                     </React.Fragment>
                   );
                 })}
                 {sortedDateKeys.length === 0 && (
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
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  `TechMedix Verification\nPatient: ${patient?.name || "N/A"}\nPatient ID: ${patient?.id || "N/A"}\nRx No: ${rxNumber || "RX-TEMP"}\nDoctor: ${doctorName}`
                )}`}
                alt="Verification QR Code"
                className="qr-box"
                style={{ width: '70px', height: '70px', border: '1px solid #cbd5e1', padding: '4px', borderRadius: '8px', background: 'white', objectFit: 'contain' }}
              />
              <p>Scan to Verify</p>
            </div>
            {isDoc ? (
              <div className="signature-block">
                <div className="sig-line"></div>
                <p>Digital Signature</p>
                <strong>{doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}</strong>
              </div>
            ) : (
              <div className="signature-block">
                <div className="sig-line"></div>
                <p>Uploaded Prescription Record</p>
                <strong>{patient?.name || "Patient Verified"}</strong>
              </div>
            )}
          </div>
          <div className="footer-bottom">
            <p>{footerText}</p>
            <p className="tm-tagline">TechMedix - Precision in Every Care</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalPrescription;
