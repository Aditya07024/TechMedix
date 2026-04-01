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
        <button
          type="button"
          className="demo-login-button"
          onClick={handleDemoDoctorLogin}
          disabled={loading}
        >
          Demo Doctor Login
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
