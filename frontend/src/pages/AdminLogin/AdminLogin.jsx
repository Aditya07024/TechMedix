import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { assets } from "../../assets/assets";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import "./AdminLogin.css";

const AdminLogin = () => {
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
      const res = await authApi.login({ email, password });
      if (!res?.data?.user || res.data.user.role !== "admin") {
        throw new Error("Invalid admin credentials");
      }

      login(res.data.user, res.data.token || null);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Admin login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAdminLogin = async () => {
    const demoEmail = "admintech@gmail.com";
    const demoPassword = "1234567890";

    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
    setLoading(true);

    try {
      const res = await authApi.login({
        email: demoEmail,
        password: demoPassword,
      });
      if (!res?.data?.user || res.data.user.role !== "admin") {
        throw new Error("Invalid admin credentials");
      }
      login(res.data.user, res.data.token || null);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Admin login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-auth-shell">
        <section className="admin-auth-hero">
          <div className="admin-auth-badge">
            <ShieldCheck size={16} strokeWidth={2.1} />
            Admin Portal
          </div>
          <h1>Secure admin access for TechMedix management.</h1>
          <p>
            Use your admin credentials to access the management console, review
            system status, and manage user workflows.
          </p>

          <div className="admin-auth-hero-card">
            <div className="admin-auth-hero-card-top">
              <img
                src={assets.logo}
                alt="TechMedix"
                className="admin-auth-logo"
              />
              <span>TechMedix</span>
            </div>
            <div className="admin-auth-stat-grid">
              <div>
                <strong>Admin</strong>
                <span>Manage users and dashboards</span>
              </div>
              <div>
                <strong>Reports</strong>
                <span>View system alerts and logs</span>
              </div>
              <div>
                <strong>Security</strong>
                <span>Maintain access for authorized users</span>
              </div>
            </div>
          </div>

          <div className="admin-auth-hero-footer">
            <LockKeyhole size={18} strokeWidth={2} />
            Admin access is restricted to authorized personnel only
          </div>
        </section>

        <section className="admin-login-form admin-auth-panel">
          <div className="admin-auth-panel-head">
            <span className="admin-auth-kicker">Login</span>
            <h2>Administrator Sign In</h2>
            <p>Enter your admin email and password to continue.</p>
          </div>

          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleLogin} className="admin-auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="admin-auth-input">
                <Mail size={18} strokeWidth={2} />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@techmedix.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="admin-auth-input">
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

            <button
              type="submit"
              className="admin-login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              className="admin-demo-login-button"
              onClick={handleDemoAdminLogin}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Demo Admin Login"}
            </button>
          </form>

          <div className="admin-auth-meta">
            <p className="admin-login-note">
              If you do not have admin credentials, ask your system
              administrator.
            </p>
            <Link to="/" className="admin-auth-home-link">
              Return to home
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminLogin;
