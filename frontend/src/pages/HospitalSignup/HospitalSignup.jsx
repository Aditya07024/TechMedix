import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hospitalApi } from "../../api";
import { assets } from "../../assets/assets";
import {
  ArrowRight,
  BadgeCheck,
  LockKeyhole,
  Mail,
  Building,
  UserRound,
  Phone,
  MapPin
} from "lucide-react";
import "./HospitalSignup.css";

const HospitalSignup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
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
      const res = await hospitalApi.signup(formData);

      if (!res.data) {
        throw new Error("Invalid response from server");
      }

      setSuccess(res.data.message || "Registration successful!");

      setTimeout(() => {
        navigate("/hospital/login");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hospital-signup-container">
      <div className="hospital-auth-shell">
        <section className="hospital-auth-hero">
          <div className="hospital-auth-badge">
            <BadgeCheck size={16} strokeWidth={2.1} />
            Institutional Onboarding
          </div>
          <h1>Set up your hospital portal in minutes.</h1>
          <p>
            Create an institutional access account to subscribe to doctor packages, link and cover multiple doctors automatically under central billing.
          </p>

          <div className="hospital-auth-hero-card">
            <div className="hospital-auth-hero-card-top">
              <img src={assets.logo} alt="TechMedix" className="hospital-auth-logo" />
              <span>Hospital Setup</span>
            </div>
            <div className="hospital-auth-stat-grid">
              <div>
                <strong>Centralized</strong>
                <span>Manage practitioners collectively</span>
              </div>
              <div>
                <strong>Unlimited slots</strong>
                <span>Flexible packages for any size</span>
              </div>
              <div>
                <strong>Instant coverage</strong>
                <span>Automatic doctor dashboard unlock</span>
              </div>
            </div>
          </div>

          <div className="hospital-auth-hero-footer">
            <Building size={18} strokeWidth={2} />
            TechMedix Corporate Institutional Network
          </div>
        </section>

        <section className="hospital-signup-form hospital-auth-panel">
          <div className="hospital-auth-panel-head">
            <span className="hospital-auth-kicker">Create Account</span>
            <h2>Hospital Registration</h2>
            <p>Enter your medical institution's details to establish your portal access.</p>
          </div>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          <form onSubmit={handleSubmit} className="hospital-auth-form">
            <div className="form-group">
              <label htmlFor="name">Hospital Name</label>
              <div className="hospital-auth-input">
                <UserRound size={18} strokeWidth={2} />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. City General Hospital"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">Official Email Address</label>
              <div className="hospital-auth-input">
                <Mail size={18} strokeWidth={2} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@hospital.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Security Password</label>
              <div className="hospital-auth-input">
                <LockKeyhole size={18} strokeWidth={2} />
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create password"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="phone">Contact Number</label>
              <div className="hospital-auth-input">
                <Phone size={18} strokeWidth={2} />
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 99999 88888"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="address">Full Postal Address</label>
              <div className="hospital-auth-input">
                <MapPin size={18} strokeWidth={2} />
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter hospital address"
                />
              </div>
            </div>

            <button type="submit" className="signup-button" disabled={loading}>
              {loading ? "Registering account..." : "Register Hospital Account"}
            </button>
          </form>

          <div className="hospital-auth-meta">
            <p className="login-link">
              Already registered?{" "}
              <span onClick={() => navigate("/hospital/login")}>Sign in here</span>
            </p>
            <Link to="/home" className="hospital-auth-home-link">
              Return to home
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HospitalSignup;
