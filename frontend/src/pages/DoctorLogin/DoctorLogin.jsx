import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doctorApi } from "../../api"; // Corrected import path
import { useAuth } from "../../context/AuthContext";
import { assets } from "../../assets/assets";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import "./DoctorLogin.css";

const DoctorLogin = () => {
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
      const res = await doctorApi.login({ email, password });

      if (!res.data || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      // Ensure role is doctor
      if (res.data.user.role !== "doctor") {
        throw new Error("Unauthorized access");
      }

      login(res.data.user, res.data.token || null);
      // Store doctor UUID for API calls (backend uses UUID)
      if (res.data.user?.id) {
        localStorage.setItem("doctorId", res.data.user.id);
      }
      navigate("/doctor/dashboard");
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

  const handleDemoDoctorLogin = async () => {
    setEmail("singh@gmail.com");
    setPassword("123456789");
    setError("");
    setLoading(true);

    try {
      let res;
      try {
        res = await doctorApi.login({
          email: "singh@gmail.com",
          password: "123456789",
        });
      } catch (loginError) {
        if (loginError?.response?.status !== 401) {
          throw loginError;
        }

        await doctorApi.signup({
          name: "Dr. Singh",
          email: "singh@gmail.com",
          password: "123456789",
          specialty: "General Medicine",
        });

        res = await doctorApi.login({
          email: "singh@gmail.com",
          password: "123456789",
        });
      }

      if (!res.data || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      if (res.data.user.role !== "doctor") {
        throw new Error("Unauthorized access");
      }

      login(res.data.user, res.data.token || null);
      if (res.data.user?.id) {
        localStorage.setItem("doctorId", res.data.user.id);
      }
      navigate("/doctor/dashboard");
    } catch (err) {
      const signupConflict =
        err?.response?.status === 409 &&
        String(err?.response?.data?.error || "").toLowerCase().includes("registered");
      setError(
        signupConflict
          ? "Demo doctor account exists, but the password does not match on the backend."
          : err.response?.data?.error || err.message || "Demo doctor login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-login-container">
      <div className="doctor-auth-shell">
        <section className="doctor-auth-hero">
          <div className="doctor-auth-badge">
            <ShieldCheck size={16} strokeWidth={2.1} />
            Doctor Portal
          </div>
          <h1>Clinical access built for a faster practice flow.</h1>
          <p>
            Sign in to manage appointments, live queue activity, prescriptions, and your doctor dashboard from one workspace.
          </p>

          <div className="doctor-auth-hero-card">
            <div className="doctor-auth-hero-card-top">
              <img src={assets.logo} alt="TechMedix" className="doctor-auth-logo" />
              <span>TechMedix</span>
            </div>
            <div className="doctor-auth-stat-grid">
              <div>
                <strong>Queue</strong>
                <span>Track patients in real time</span>
              </div>
              <div>
                <strong>Safety</strong>
                <span>Review medication workflows</span>
              </div>
              <div>
                <strong>Visits</strong>
                <span>Stay ready before consultation</span>
              </div>
            </div>
          </div>

          <div className="doctor-auth-hero-footer">
            <Stethoscope size={18} strokeWidth={2} />
            Secure access for registered doctors only
          </div>
        </section>

        <section className="doctor-login-form doctor-auth-panel">
          <div className="doctor-auth-panel-head">
            <span className="doctor-auth-kicker">Welcome Back</span>
            <h2>Doctor Sign In</h2>
            <p>Use your registered email and password to open the doctor dashboard.</p>
          </div>

          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleLogin} className="doctor-auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="doctor-auth-input">
                <Mail size={18} strokeWidth={2} />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              onClick={handleDemoDoctorLogin}
              disabled={loading}
            >
              Demo Doctor Login
            </button>
          </form>

          <div className="doctor-auth-meta">
            <p className="signup-link">
              New doctor on TechMedix?{" "}
              <span onClick={() => navigate("/doctor/signup")}>Create account</span>
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

export default DoctorLogin;
