import React, { useState, useEffect, useRef } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import Button from "@mui/material/Button";
import Aipop from "../../components/AiPop/Aipop";
import { useAuth } from "../../context/AuthContext";
import { Menu, X } from "lucide-react";

const Navbar = ({ setShowLogin }) => {
  const [askAi, setAskAi] = useState(false);
  const [menu, setMenu] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isPatientDashboard = location.pathname === "/dashboard";

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // ✅ REDIRECT TO UPLOAD PAGE
  const handleUploadRedirect = () => {
    setShowProfileMenu(false);
    navigate("/upload-prescription");
  };

  const navLinks = [
    isAuthenticated && user?.role === "patient"
      ? {
          key: "dashboard",
          to: "/dashboard",
          label: "Patient Dashboard",
        }
      : null,
    isAuthenticated && user?.role === "doctor"
      ? {
          key: "doctor-dashboard",
          to: "/doctor/dashboard",
          label: "Doctor Dashboard",
        }
      : null,
    {
      key: "search-for-medicine",
      to: "/search",
      label: "Search for medicine",
    },
    {
      key: "reminders",
      to: "/reminders",
      label: "Reminders",
    },
    {
      key: "health-tips",
      to: "/health-tips",
      label: "Health Tips",
    },
  ].filter(Boolean);

  return (
    <div
      className={`navbar glass-navbar ${isPatientDashboard ? "navbar-fixed-dashboard" : ""}`}
    >
      <div className="glass-layer glass-layer--blur" />
      <div className="glass-layer glass-layer--tint" />
      <div className="glass-layer glass-layer--shine" />

      <div className="navbar-inner">
        {askAi && <Aipop setShowAiPop={setAskAi} />}

        <Link to="/">
          <img src={assets.logo} alt="logo" className="logo" />
        </Link>

        <ul className={`navbar-menu ${mobileMenuOpen ? "open" : ""}`}>
          {navLinks.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => setMenu(item.key)}
              className={menu === item.key ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </ul>

        <div className="navbar-right">
          {/* <div className="ai-div">
            <Button className="ai-button" onClick={() => setAskAi(true)}>
              Ask to AI Doctor
            </Button>
          </div> */}

          {/* THEME TOGGLE */}
          <div className="theme-toggle" onClick={toggleTheme}>
            <div className={`toggle-track ${isDarkMode ? "dark" : "light"}`}>
              <div className="toggle-thumb">{isDarkMode ? "🌙" : "☀️"}</div>
            </div>
          </div>

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

          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={20} strokeWidth={2.2} />
            ) : (
              <Menu size={20} strokeWidth={2.2} />
            )}
          </button>
        </div>
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
