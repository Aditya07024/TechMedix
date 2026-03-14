import React, { useState, useEffect, useRef } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import Button from "@mui/material/Button";
import Aipop from "../../components/AiPop/Aipop";
import { useAuth } from "../../context/AuthContext";

const Navbar = ({ setShowLogin }) => {
  const [askAi, setAskAi] = useState(false);
  const [menu, setMenu] = useState("home");
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // PROFILE DROPDOWN
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ✅ REDIRECT TO UPLOAD PAGE
  const handleUploadRedirect = () => {
    setShowProfileMenu(false);
    navigate("/upload-prescription");
  };

  return (
    <div className="navbar">
      {askAi && <Aipop setShowAiPop={setAskAi} />}

      <Link to="/">
        <img src={assets.logo} alt="logo" className="logo" />
      </Link>

      <ul className="navbar-menu">
        {isAuthenticated && user?.role === "patient" && (
          <Link
            to="/dashboard"
            onClick={() => setMenu("dashboard")}
            className={menu === "dashboard" ? "active" : ""}
          >
            Patient Dashboard
          </Link>
        )}

        {isAuthenticated && user?.role === "doctor" && (
          <Link
            to="/doctor/dashboard"
            onClick={() => setMenu("doctor-dashboard")}
            className={menu === "doctor-dashboard" ? "active" : ""}
          >
            Doctor Dashboard
          </Link>
        )}

        <Link to="/search" onClick={() => setMenu("search-for-medicine")}>
          Search for medicine
        </Link>

        <Link to="/reminders" onClick={() => setMenu("reminders")}>
          💊 Reminders
        </Link>

        {/* <a href="#buy-products" onClick={() => setMenu("buy-products")}>
          Buy Products
        </a> */}

        <Link to="/health-tips" onClick={() => setMenu("health-tips")}>
          Health Tips
        </Link>

      </ul>

      <div className="navbar-right">
        <div className="ai-div">
          <Button className="ai-button" onClick={() => setAskAi(true)}>
            Ask to AI Doctor
          </Button>
        </div>

        {/* THEME TOGGLE */}
        <label className="switch">
          <input
            type="checkbox"
            className="input"
            onChange={toggleTheme}
            checked={isDarkMode}
          />
          <span className="slider"></span>
        </label>

        <div className="nav-icon-container">
          <Link to="/wishlist">
            <img src={assets.wishlist} alt="Wishlist" className="nav-icon" />
          </Link>
        </div>

        {/* LOGIN ICON */}
        {!isAuthenticated && (
          <div className="nav-icon-container">
            <button className="nav-btn" onClick={() => setShowLogin(true)}>
              <img
                src={assets.account_icon}
                alt="Account"
                className="nav-icon"
              />
            </button>
          </div>
        )}

        {/* PROFILE ICON + DROPDOWN */}
        {isAuthenticated && (
          <div className="nav-icon-container" ref={profileRef}>
            <button
              className="nav-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <img
                src={assets.account_icon}
                alt="Profile"
                className="nav-icon"
              />
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  background: "white",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  width: "180px",
                  zIndex: 2000,
                  overflow: "hidden",
                }}
              >
                

                <button
                  style={{ ...dropdownBtnStyle, color: "red" }}
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const dropdownBtnStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "none",
  background: "transparent",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
};

export default Navbar;
