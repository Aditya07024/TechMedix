import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LockKeyhole, Mail, UsersRound } from "lucide-react";
import { authApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./StaffLogin.css";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.staffLogin({ email, password });
      const payload = response?.data;

      if (!payload?.user || payload.user.role !== "staff") {
        throw new Error("Invalid staff login response");
      }

      login(payload.user, payload.token || null);
      navigate("/staff/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Staff login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-login-page">
      <div className="staff-login-shell">
        <section className="staff-login-hero">
          <span className="staff-login-tag">TechMedix Staff Console</span>
          <h1>Operations, queue flow, and patient handoff in one dashboard.</h1>
          <p>
            Hospital staff can manage arrivals, issue queue tokens, upload reports,
            and notify doctors without touching doctor-only clinical data.
          </p>

          <div className="staff-login-feature-grid">
            <article>
              <ClipboardList size={20} />
              <strong>Queue control</strong>
              <span>Generate tokens and update live queue state.</span>
            </article>
            <article>
              <UsersRound size={20} />
              <strong>Patient assistance</strong>
              <span>Review limited patient details and upload reports.</span>
            </article>
          </div>
        </section>

        <section className="staff-login-panel">
          <div className="staff-login-header">
            <p>Restricted Access</p>
            <h2>Staff Sign In</h2>
          </div>

          {error && <div className="staff-login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="staff-login-form">
            <label>
              Email
              <div className="staff-login-input">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="staff@techmedix.com"
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="staff-login-input">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </label>

            <button type="submit" disabled={loading} className="staff-login-button">
              {loading ? "Signing in..." : "Open Staff Dashboard"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
