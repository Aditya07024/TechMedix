import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, doctorApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import "./ProfileManager.css";

const getInitialForm = (role, profile = {}) => ({
  name: profile.name || "",
  email: profile.email || "",
  phone: profile.phone || "",
  age: profile.age ?? "",
  gender: profile.gender || "",
  bloodGroup: profile.bloodGroup || "",
  medicalHistory: profile.medicalHistory || "",
  specialty: profile.specialty || "",
  consultation_fee: profile.consultation_fee ?? "",
  department: profile.department || "",
  clinic_address: profile.clinic_address || "",
  qrShareEhr: profile.qrShareEhr ?? true,
  qrSharePrescriptions: profile.qrSharePrescriptions ?? true,
  qrShareRecordings: profile.qrShareRecordings ?? true,
  qrShareReports: profile.qrShareReports ?? true,
  qrShareMetrics: profile.qrShareMetrics ?? true,
});

export default function ProfileManager({
  title = "Profile",
  roleOverride = null,
  onProfileUpdated,
  onQrReset,
}) {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const role = roleOverride || user?.role || "patient";

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(getInitialForm(role));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingQr, setResettingQr] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Prescription customization states
  const [padThemeColor, setPadThemeColor] = useState(() => localStorage.getItem("padThemeColor") || "#0f6b57");
  const [padFontFamily, setPadFontFamily] = useState(() => localStorage.getItem("padFontFamily") || "Inter");
  const [padLayout, setPadLayout] = useState(() => localStorage.getItem("padLayout") || "split");
  const [padLogoVisible, setPadLogoVisible] = useState(() => localStorage.getItem("padLogoVisible") === "false" ? false : true);

  // Prescription pad text customizer states
  const [padClinicName, setPadClinicName] = useState(() => localStorage.getItem("padClinicName") || "TechMedix Clinical Sanctuary");
  const [padClinicAddress, setPadClinicAddress] = useState(() => localStorage.getItem("padClinicAddress") || "124, Healthcare Boulevard, Medical District");
  const [padClinicContact, setPadClinicContact] = useState(() => localStorage.getItem("padClinicContact") || "");
  const [padDoctorSpecialty, setPadDoctorSpecialty] = useState(() => localStorage.getItem("padDoctorSpecialty") || "");
  const [padDoctorRegNo, setPadDoctorRegNo] = useState(() => localStorage.getItem("padDoctorRegNo") || "");
  const [padFooterText, setPadFooterText] = useState(() => localStorage.getItem("padFooterText") || "This is a digitally generated prescription. It does not require a physical stamp for validation.");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");
      const response =
        role === "doctor"
          ? await doctorApi.getProfile()
          : role === "staff"
            ? await authApi.staffProfile()
            : await authApi.getProfile();
      const nextProfile = response.data?.data || null;
      setProfile(nextProfile);
      setForm(getInitialForm(role, nextProfile));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const syncAuthUser = (nextProfile) => {
    const token = localStorage.getItem("token");
    const mergedUser = {
      ...user,
      ...nextProfile,
      role,
      name: nextProfile?.name || user?.name || user?.full_name || "",
      full_name: nextProfile?.name || user?.full_name || user?.name || "",
      phone: nextProfile?.phone ?? user?.phone ?? "",
      email: nextProfile?.email || user?.email || "",
      uniqueCode: nextProfile?.uniqueCode ?? user?.uniqueCode ?? null,
      qrShareEhr: nextProfile?.qrShareEhr ?? user?.qrShareEhr ?? true,
      qrSharePrescriptions: nextProfile?.qrSharePrescriptions ?? user?.qrSharePrescriptions ?? true,
      qrShareRecordings: nextProfile?.qrShareRecordings ?? user?.qrShareRecordings ?? true,
      qrShareReports: nextProfile?.qrShareReports ?? user?.qrShareReports ?? true,
      qrShareMetrics: nextProfile?.qrShareMetrics ?? user?.qrShareMetrics ?? true,
    };

    login(mergedUser, token);
    onProfileUpdated?.(nextProfile);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = { ...form };

      if (role === "patient") {
        payload.age = payload.age === "" ? null : Number(payload.age);
      }

      if (role === "doctor") {
        payload.consultation_fee =
          payload.consultation_fee === "" ? null : Number(payload.consultation_fee);
      }

      const response =
        role === "doctor"
          ? await doctorApi.updateProfile(payload)
          : await authApi.updateProfile(payload);
      const nextProfile = response.data?.data || null;
      setProfile(nextProfile);
      setForm(getInitialForm(role, nextProfile));
      syncAuthUser(nextProfile);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this account permanently? This action cannot be undone.")) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await authApi.deleteProfile();
      await logout();
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetQr = async () => {
    try {
      setResettingQr(true);
      setError("");
      setMessage("");
      const response = await authApi.resetPatientQrCode();
      const nextProfile = response.data?.data || null;
      setProfile(nextProfile);
      setForm(getInitialForm(role, nextProfile));
      syncAuthUser(nextProfile);
      onQrReset?.(nextProfile);
      setMessage("Patient QR code has been reset.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset QR code.");
    } finally {
      setResettingQr(false);
    }
  };

  if (loading) {
    return <div className="profile-manager-card">Loading profile...</div>;
  }

  const isPatient = role === "patient";
  const isDoctor = role === "doctor";
  const isStaff = role === "staff";

  return (
    <section className="profile-manager-card">
      <div className="profile-manager-head">
        <div>
          <span className="profile-manager-kicker">Account</span>
          <h3>{title}</h3>
        </div>
        <div className="profile-manager-role">{role}</div>
      </div>

      {message ? <div className="profile-manager-message success">{message}</div> : null}
      {error ? <div className="profile-manager-message error">{error}</div> : null}

      <form className="profile-manager-form" onSubmit={handleSave}>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>

        {!isDoctor ? (
          <label>
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </label>
        ) : null}

        {isPatient ? (
          <>
            <label>
              <span>Age</span>
              <input
                type="number"
                value={form.age}
                onChange={(event) => updateField("age", event.target.value)}
              />
            </label>
            <label>
              <span>Gender</span>
              <input
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value)}
              />
            </label>
            <label>
              <span>Blood Group</span>
              <input
                value={form.bloodGroup}
                onChange={(event) => updateField("bloodGroup", event.target.value)}
              />
            </label>
            <label className="profile-manager-full">
              <span>Medical History</span>
              <textarea
                rows="4"
                value={form.medicalHistory}
                onChange={(event) => updateField("medicalHistory", event.target.value)}
              />
            </label>
            <label>
              <span>Current QR Code</span>
              <input value={profile?.uniqueCode || ""} readOnly />
            </label>
            <div className="profile-manager-full" style={{ marginTop: "18px", borderTop: "1px solid var(--doctor-line)", paddingTop: "18px" }}>
              <span className="profile-manager-kicker" style={{ display: "block", marginBottom: "12px", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: "800", letterSpacing: "0.08em", color: "var(--doctor-muted)" }}>
                QR / Manual Code Access Sharing Preferences
              </span>
              <p style={{ fontSize: "0.85rem", color: "var(--doctor-muted)", marginBottom: "14px", marginTop: 0 }}>
                Choose what health information is shared when a medical provider scans your QR code or enters your manual access code.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", background: "none", border: "none", padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.qrShareEhr}
                    onChange={(event) => updateField("qrShareEhr", event.target.checked)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>EHR History</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", background: "none", border: "none", padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.qrSharePrescriptions}
                    onChange={(event) => updateField("qrSharePrescriptions", event.target.checked)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>Prescriptions</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", background: "none", border: "none", padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.qrShareRecordings}
                    onChange={(event) => updateField("qrShareRecordings", event.target.checked)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>Recordings</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", background: "none", border: "none", padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.qrShareReports}
                    onChange={(event) => updateField("qrShareReports", event.target.checked)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>Reports & Files</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", background: "none", border: "none", padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.qrShareMetrics}
                    onChange={(event) => updateField("qrShareMetrics", event.target.checked)}
                    style={{ width: "auto", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.9rem" }}>Health Metrics</span>
                </label>
              </div>
            </div>
          </>
        ) : null}

        {isDoctor ? (
          <>
            <label>
              <span>Doctor UUID</span>
              <input value={profile?.id || user?.id || ""} readOnly />
            </label>
            <label>
              <span>Specialty</span>
              <input
                value={form.specialty}
                onChange={(event) => updateField("specialty", event.target.value)}
              />
            </label>
            <label>
              <span>Consultation Fee</span>
              <input
                type="number"
                value={form.consultation_fee}
                onChange={(event) =>
                  updateField("consultation_fee", event.target.value)
                }
              />
            </label>
            <label className="profile-manager-full">
              <span>Clinic Address</span>
              <textarea
                rows="3"
                value={form.clinic_address}
                onChange={(event) => updateField("clinic_address", event.target.value)}
                placeholder="Enter clinic address details..."
              />
            </label>
          </>
        ) : null}

        {isDoctor ? (
          <div className="profile-manager-full" style={{ marginTop: "24px", borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: "24px" }}>
            <span className="profile-manager-kicker" style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", fontWeight: "700", color: "#4f72f0" }}>
              DESIGN CUSTOMIZATION
            </span>
            <h4 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: "800", color: "var(--color-text, #0f172a)" }}>
              Prescription Pad Layout & Branding Styling
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "16px" }}>
              {/* Color Selector */}
              <div>
                <span style={{ display: "block", fontSize: "0.88rem", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>
                  Theme Primary Color
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { hex: "#0f6b57", label: "Emerald" },
                    { hex: "#4f72f0", label: "Tech Blue" },
                    { hex: "#e11d48", label: "Rose" },
                    { hex: "#7c3aed", label: "Violet" },
                    { hex: "#0891b2", label: "Cyan" },
                    { hex: "#475569", label: "Slate" }
                  ].map(color => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => {
                        setPadThemeColor(color.hex);
                        localStorage.setItem("padThemeColor", color.hex);
                      }}
                      title={color.label}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: color.hex,
                        border: padThemeColor === color.hex ? "3px solid #0f172a" : "1px solid rgba(0,0,0,0.15)",
                        cursor: "pointer",
                        boxShadow: padThemeColor === color.hex ? "0 0 0 2px #fff" : "none",
                        padding: 0,
                        transition: "transform 0.15s ease"
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Font Selector */}
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Typography Font Style</span>
                <select
                  value={padFontFamily}
                  onChange={(e) => {
                    setPadFontFamily(e.target.value);
                    localStorage.setItem("padFontFamily", e.target.value);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(15, 23, 42, 0.15)",
                    backgroundColor: "#fff",
                    color: "#0f172a",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                >
                  <option value="Inter">Modern Sans (Inter)</option>
                  <option value="serif">Classic Serif (Georgia)</option>
                  <option value="mono">Developer Mono (Courier)</option>
                </select>
              </label>

              {/* Layout Selector */}
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Header Layout Alignment</span>
                <select
                  value={padLayout}
                  onChange={(e) => {
                    setPadLayout(e.target.value);
                    localStorage.setItem("padLayout", e.target.value);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(15, 23, 42, 0.15)",
                    backgroundColor: "#fff",
                    color: "#0f172a",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                >
                  <option value="split">Split Ends</option>
                  <option value="left">Left Aligned</option>
                  <option value="center">Centered Branding</option>
                </select>
              </label>

              {/* Logo Visibility */}
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Show Clinic Branding Logo</span>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !padLogoVisible;
                    setPadLogoVisible(newVal);
                    localStorage.setItem("padLogoVisible", String(newVal));
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    backgroundColor: padLogoVisible ? "#0f6b57" : "#64748b",
                    color: "white",
                    border: "none",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}
                >
                  {padLogoVisible ? "✓ Branding Logo Visible" : "Branding Logo Hidden"}
                </button>
              </label>
            </div>
            
            {/* Custom Texts Section */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "24px", borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: "20px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Clinic Name Display</span>
                <input
                  type="text"
                  value={padClinicName}
                  onChange={(e) => {
                    setPadClinicName(e.target.value);
                    localStorage.setItem("padClinicName", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontSize: "0.9rem" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Clinic Contact Info</span>
                <input
                  type="text"
                  value={padClinicContact}
                  placeholder={form.phone ? `${form.phone} | ${form.email}` : "e.g. +91 9999999999 | doc@clinic.com"}
                  onChange={(e) => {
                    setPadClinicContact(e.target.value);
                    localStorage.setItem("padClinicContact", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontSize: "0.9rem" }}
                />
              </label>

              <label className="profile-manager-full" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Clinic Address Display</span>
                <textarea
                  rows="2"
                  value={padClinicAddress}
                  onChange={(e) => {
                    setPadClinicAddress(e.target.value);
                    localStorage.setItem("padClinicAddress", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontFamily: "inherit", fontSize: "0.9rem" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Designation / Specialty Override</span>
                <input
                  type="text"
                  value={padDoctorSpecialty}
                  placeholder={form.specialty || "Specialist Consultant"}
                  onChange={(e) => {
                    setPadDoctorSpecialty(e.target.value);
                    localStorage.setItem("padDoctorSpecialty", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontSize: "0.9rem" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Medical Registration No. Override</span>
                <input
                  type="text"
                  value={padDoctorRegNo}
                  placeholder="e.g. Reg No: MC-12345"
                  onChange={(e) => {
                    setPadDoctorRegNo(e.target.value);
                    localStorage.setItem("padDoctorRegNo", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontSize: "0.9rem" }}
                />
              </label>

              <label className="profile-manager-full" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: "600", color: "#475569" }}>Legal Disclaimer (Footer)</span>
                <textarea
                  rows="2"
                  value={padFooterText}
                  onChange={(e) => {
                    setPadFooterText(e.target.value);
                    localStorage.setItem("padFooterText", e.target.value);
                  }}
                  style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(15, 23, 42, 0.15)", fontFamily: "inherit", fontSize: "0.9rem" }}
                />
              </label>
            </div>
            
            {/* Minimal style description */}
            <p style={{ margin: "16px 0 0 0", fontSize: "0.78rem", color: "#64748b", fontStyle: "italic" }}>
              These configurations are dynamically applied to your prescription pads during patient consult workspace and live printing.
            </p>
          </div>
        ) : null}

        {isStaff ? (
          <label>
            <span>Department</span>
            <input
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
            />
          </label>
        ) : null}

        
        

        <div className="profile-manager-actions profile-manager-full">
          <button type="submit" className="profile-primary-btn" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          {isPatient ? (
            <button
              type="button"
              className="profile-secondary-btn"
              onClick={handleResetQr}
              disabled={resettingQr}
            >
              {resettingQr ? "Resetting..." : "Reset QR Code"}
            </button>
          ) : null}
          <button
            type="button"
            className="profile-danger-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </form>
    </section>
  );
}
