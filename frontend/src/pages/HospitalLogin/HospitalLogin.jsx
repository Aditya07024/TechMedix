import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hospitalApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { assets } from "../../assets/assets";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Building } from "lucide-react";
import "./HospitalLogin.css";

const HospitalLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await hospitalApi.login({ email, password });

      if (!res.data || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      if (res.data.user.role !== "hospital") {
        throw new Error("Unauthorized access");
      }

      login(res.data.user, res.data.token || null);
      navigate("/hospital/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoHospitalLogin = async () => {
    setEmail("maxhealthcare@gmail.com");
    setPassword("12345678");
    setError("");
    setLoading(true);

    try {
      let res;
      try {
        res = await hospitalApi.login({
          email: "maxhealthcare@gmail.com",
          password: "12345678",
        });
      } catch (loginError) {
        if (loginError?.response?.status !== 401) {
          throw loginError;
        }

        // Register demo hospital if not exists
        await hospitalApi.signup({
          name: "Max Super Speciality Hospital",
          email: "maxhealthcare@gmail.com",
          password: "12345678",
          phone: "011-26515050",
          address: "1, 2, Press Enclave Road, Saket, New Delhi",
        });

        res = await hospitalApi.login({
          email: "maxhealthcare@gmail.com",
          password: "12345678",
        });
      }

      if (!res.data || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      login(res.data.user, res.data.token || null);
      navigate("/hospital/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Demo hospital login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hospital-login-container">
      <div className="hospital-auth-shell">
        <section className="hospital-auth-hero">
          <div className="hospital-auth-badge">
            <ShieldCheck size={16} strokeWidth={2.1} />
            Hospital Portal
          </div>
          <h1>Manage subscription packages for all your linked doctors.</h1>
          <p>
            Sign in to check slot utilization, link new practitioners, and ensure continuous practice access for your entire clinic or hospital.
          </p>

          <div className="hospital-auth-hero-card">
            <div className="hospital-auth-hero-card-top">
              <img src={assets.logo} alt="TechMedix" className="hospital-auth-logo" />
              <span>Hospital Panel</span>
            </div>
            <div className="hospital-auth-stat-grid">
              <div>
                <strong>Unlimited</strong>
                <span>Link doctors dynamically</span>
              </div>
              <div>
                <strong>Central billing</strong>
                <span>One package covers all</span>
              </div>
              <div>
                <strong>Slot view</strong>
                <span>Monitor active linked status</span>
              </div>
            </div>
          </div>

          <div className="hospital-auth-hero-footer">
            <Building size={18} strokeWidth={2} />
            Secure corporate access for medical institutions
          </div>
        </section>

        <section className="hospital-login-form hospital-auth-panel">
          <div className="hospital-auth-panel-head">
            <span className="hospital-auth-kicker">Welcome Back</span>
            <h2>Hospital Sign In</h2>
            <p>Use your institutional credentials to open the hospital dashboard.</p>
          </div>

          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleLogin} className="hospital-auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="hospital-auth-input">
                <Mail size={18} strokeWidth={2} />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hospital.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="hospital-auth-input">
                <LockKeyhole size={18} strokeWidth={2} />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Logging in..." : "Sign In"}
            </button>
            <button
              type="button"
              className="demo-login-button"
              onClick={handleDemoHospitalLogin}
              disabled={loading}
            >
              Demo Hospital Login
            </button>
          </form>

          <div className="hospital-auth-meta">
            <p className="signup-link">
              New institution on TechMedix?{" "}
              <span onClick={() => navigate("/hospital/signup")}>Register here</span>
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

export default HospitalLogin;
