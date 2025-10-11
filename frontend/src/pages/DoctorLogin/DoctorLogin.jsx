import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doctorApi } from "../../api"; // Corrected import path
import { useAuth } from "../../context/AuthContext";
import "./DoctorLogin.css";

const DoctorLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await doctorApi.login({ email, password }); // Corrected API call
      login(res.data.user); // Store doctor user data in context
      navigate("/doctor/dashboard"); // Redirect to doctor dashboard
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
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
        <button type="submit" className="login-button">
          Login
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
