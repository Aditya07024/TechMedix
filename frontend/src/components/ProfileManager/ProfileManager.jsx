import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, doctorApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
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
  reg_no: profile.reg_no || "",
});

export default function ProfileManager({
  title = "Profile",
  roleOverride = null,
  onProfileUpdated,
  onQrReset,
}) {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const role = roleOverride || user?.role || "patient";

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(getInitialForm(role));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingQr, setResettingQr] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      reg_no: nextProfile?.reg_no ?? user?.reg_no ?? "",
      uniqueCode: nextProfile?.uniqueCode ?? user?.uniqueCode ?? null,
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

        <label>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </label>

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
            <label>
              <span>Registration Number</span>
              <input
                value={form.reg_no}
                onChange={(event) => updateField("reg_no", event.target.value)}
              />
            </label>
          </>
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
