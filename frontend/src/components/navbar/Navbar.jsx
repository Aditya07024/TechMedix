import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // ✅ REDIRECT TO UPLOAD PAGE
  const handleUploadRedirect = () => {
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

        <Link to="/home">
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
            <div className="nav-icon-container">
              <button className="nav-btn" onClick={logout}>
                <img
                  src={assets.logout_icon}
                  alt="Logout"
                  className="nav-icon"
                />
              </button>
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

export default Navbar;
