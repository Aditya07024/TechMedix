import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doctorApi } from "../../api"; // Corrected import path
import { useAuth } from "../../context/AuthContext";
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

  return (
    <div className="doctor-login-container">
      <form onSubmit={handleLogin} className="doctor-login-form">
        <h2>Doctor Login</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
        <p className="signup-link">
          Don't have an account?{" "}
          <span onClick={() => navigate("/doctor/signup")}>Sign Up</span>
        </p>
      </form>
    </div>
  );
};

export default DoctorLogin;
