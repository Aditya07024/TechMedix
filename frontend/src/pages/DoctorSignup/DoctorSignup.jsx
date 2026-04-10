import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doctorApi } from "../../api";
import { assets } from "../../assets/assets";
import {
  ArrowRight,
  BadgeCheck,
  LockKeyhole,
  Mail,
  Stethoscope,
  UserRound,
} from "lucide-react";
import "./DoctorSignup.css";

const DoctorSignup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    specialty: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await doctorApi.signup(formData);

      if (!res.data) {
        throw new Error("Invalid response from server");
      }

      setSuccess(res.data.message || "Signup successful");

      setTimeout(() => {
        navigate("/doctor/login");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        "Signup failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-signup-container">
      <div className="doctor-auth-shell">
        <section className="doctor-auth-hero">
          <div className="doctor-auth-badge">
            <BadgeCheck size={16} strokeWidth={2.1} />
            Verified Doctor Access
          </div>
          <h1>Set up your doctor account with a cleaner onboarding flow.</h1>
          <p>
            Create your professional access profile to manage appointments, consultation readiness, and patient operations in one place.
          </p>

          <div className="doctor-auth-hero-card">
            <div className="doctor-auth-hero-card-top">
              <img src={assets.logo} alt="TechMedix" className="doctor-auth-logo" />
              <span>Practice Setup</span>
            </div>
            <div className="doctor-auth-stat-grid">
              <div>
                <strong>Profile</strong>
                <span>Set your specialty and practice identity</span>
              </div>
              <div>
                <strong>Consult</strong>
                <span>Access appointments and patient activity</span>
              </div>
              <div>
                <strong>Dashboard</strong>
                <span>Start from a single clinical workspace</span>
              </div>
            </div>
          </div>

          <div className="doctor-auth-hero-footer">
            <Stethoscope size={18} strokeWidth={2} />
            Registration is intended for clinicians using the doctor dashboard
          </div>
        </section>

        <section className="doctor-signup-form doctor-auth-panel">
          <div className="doctor-auth-panel-head">
            <span className="doctor-auth-kicker">Create Account</span>
            <h2>Doctor Sign Up</h2>
            <p>Enter your details to create a doctor account and continue to login.</p>
          </div>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          <form onSubmit={handleSubmit} className="doctor-auth-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <div className="doctor-auth-input">
                <UserRound size={18} strokeWidth={2} />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Dr. Ananya Sharma"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="doctor-auth-input">
                <Mail size={18} strokeWidth={2} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="doctor@clinic.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="doctor-auth-input">
                <LockKeyhole size={18} strokeWidth={2} />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a secure password"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="specialty">Specialty</label>
              <div className="doctor-auth-input">
                <Stethoscope size={18} strokeWidth={2} />
                <input
                  type="text"
                  id="specialty"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  placeholder="Cardiology, General Medicine, Pediatrics..."
                  required
                />
              </div>
            </div>

            <button type="submit" className="signup-button" disabled={loading}>
              {loading ? "Creating account..." : "Create Doctor Account"}
            </button>
          </form>

          <div className="doctor-auth-meta">
            <p className="login-link">
              Already registered?{" "}
              <span onClick={() => navigate("/doctor/login")}>Sign in</span>
            </p>
            <Link to="/home" className="doctor-auth-home-link">
              Return to home
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DoctorSignup;
