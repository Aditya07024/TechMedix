import React, { useState } from "react";
import "./LoginPop.css";
import { assets } from "../../assets/assets";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../api";
import { useLocation, useNavigate } from "react-router-dom";

const LoginPop = ({ setShowLogin }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const [currState, setCurrState] = useState("Sign Up");
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");

  /* ---------------- GOOGLE LOGIN ---------------- */
  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        const res = await authApi.google(response.access_token);

        localStorage.setItem("user", JSON.stringify(res.data.user));
        login(res.data.user, res.data.token || null);

        setShowLogin(false);
        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error(err);
        setError("Google login failed");
      }
    },
    onError: () => setError("Google login failed"),
    flow: "implicit",
  });

  /* ---------------- EMAIL LOGIN / SIGNUP ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      let res;

      if (currState === "Sign Up") {
        res = await authApi.signup({
          name,
          email,
          password,
          age,
          gender,
          phone,
          bloodGroup,
          medicalHistory,
        });

        alert("Signup successful! Please login.");
        setCurrState("Login");
        return;
      } else {
        res = await authApi.login({ email, password });
      }

      if (res?.data?.user) {
        const userData = {
          ...res.data.user,
          role: res.data.user?.role || "patient",
        };

        localStorage.setItem("user", JSON.stringify(userData));
        console.log("User role:", userData.role);
        login(userData, res.data.token || null);

        setShowLogin(false);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Authentication failed");
    }
  };

  const handleDemoPatientLogin = async () => {
    setCurrState("Login");
    setEmail("demo@gmail.com");
    setPassword("1234589");
    setError(null);

    try {
      let res;
      try {
        res = await authApi.login({
          email: "demo@gmail.com",
          password: "1234589",
        });
      } catch (loginError) {
        if (loginError?.response?.status !== 401) {
          throw loginError;
        }

        await authApi.signup({
          name: "Demo Patient",
          email: "demo@gmail.com",
          password: "1234589",
          age: "28",
          gender: "Male",
          phone: "9999999999",
          bloodGroup: "B+",
          medicalHistory: "No major medical history",
        });

        res = await authApi.login({
          email: "demo@gmail.com",
          password: "1234589",
        });
      }

      if (res?.data?.user) {
        const userData = {
          ...res.data.user,
          role: res.data.user?.role || "patient",
        };

        localStorage.setItem("user", JSON.stringify(userData));
        login(userData, res.data.token || null);
        setShowLogin(false);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      console.error(err);
      const signupConflict =
        err?.response?.status === 400 &&
        String(err?.response?.data?.error || "").toLowerCase().includes("exists");
      setError(
        signupConflict
          ? "Demo patient account exists, but the password does not match on the backend."
          : err.response?.data?.error || "Demo patient login failed",
      );
    }
  };

  return (
    <div className="pop">
      {/* ---------------- LEFT SIDE ---------------- */}
      <div className="pop-left">
        <div className="card">
          <div className="img">
            <img src={assets.logo} alt="logo" />
          </div>

          <span>About Us</span>

          <p className="info">
            Join TechMedix to streamline your pharmacy operations. Our platform
            helps you manage medicines and connect with customers seamlessly.
          </p>

          <button>techmedix@gmail.com</button>
        </div>
      </div>

      {/* ---------------- RIGHT SIDE ---------------- */}
      <div className="pop-right">
        <div className="login-pop">
          <form className="login-popup-container" onSubmit={handleSubmit}>
            <div className="login-popup-title">
              <h2>{currState}</h2>
              <img
                src={assets.cross_icon}
                alt="close"
                onClick={() => setShowLogin(false)}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="login-popup-inputs">
              {currState === "Sign Up" && (
                <input
                  type="text"
                  placeholder="Enter your Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              {currState === "Sign Up" && (
                <div className="divide-row">
                  <input
                    type="number"
                    placeholder="Age"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Gender"
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  />
                </div>
              )}

              {currState === "Sign Up" && (
                <div className="divide-row">
                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Blood Group"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  />
                </div>
              )}

              {currState === "Sign Up" && (
                <input
                  type="text"
                  placeholder="Medical History"
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                />
              )}

              <div className="divide-row">
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit">
              {currState === "Sign Up" ? "Create Account" : "Login"}
            </button>

            {currState === "Login" && (
              <button
                type="button"
                className="demo-login-btn"
                onClick={handleDemoPatientLogin}
              >
                Demo Patient Login
              </button>
            )}

            <p>
              {currState === "Login" ? (
                <>
                  Create a new account?
                  <span onClick={() => setCurrState("Sign Up")}> Click here</span>
                </>
              ) : (
                <>
                  Already have an account?
                  <span onClick={() => setCurrState("Login")}> Login here</span>
                </>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPop;
