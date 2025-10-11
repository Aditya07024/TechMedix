const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import Button from "@mui/material/Button";
import Aipop from "../../components/AiPop/Aipop";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext"; // Import useAuth hook

const Navbar = ({ setShowLogin }) => {
  const [askAi, setAskAi] = useState(false);
  const [menu, setMenu] = useState("home");
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth(); // Use useAuth hook for user and logout
  const navigate = useNavigate();

  // Remove the useEffect for auth status as it's now handled by AuthContext
  // useEffect(() => {
  //   fetch(`${API_URL}/auth/status`, {
  //     method: "GET",
  //     credentials: "include",
  //   })
  //     .then((res) => res.json())
  //     .then((data) => {
  //       setIfLogin(data.ifLogin);
  //     })
  //     .catch((err) => {
  //       setIfLogin(false);
  //     });
  // }, []);

  const handleClick = () => {
    navigate("/new");
  };

  return (
    <div className="navbar">
      {askAi && <Aipop setShowAiPop={setAskAi} />}

      <Link to="/">
        <img src={assets.logo} alt="" className="logo" />
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
        <Link
          to="/search"
          onClick={() => setMenu("search-for-medicine")}
          className={menu === "search-for-medicine" ? "active" : ""}
        >
          Search for medicine
        </Link>
        <Link
          to="/reminders"
          onClick={() => setMenu("reminders")}
          className={menu === "reminders" ? "active" : ""}
        >
          💊 Reminders
        </Link>
        <a
          href="#buy-products"
          onClick={() => setMenu("buy-products")}
          className={menu === "buy-products" ? "active" : ""}
        >
          Buy Products
        </a>
        <Link
          to="/health-tips"
          onClick={() => setMenu("health-tips")}
          className={menu === "health-tips" ? "active" : ""}
        >
          Health Tips
        </Link>
        <a
          href="#Faq"
          onClick={() => setMenu("Faq")}
          className={menu === "Faq" ? "active" : ""}
        >
          FAQ
        </a>
      </ul>
      <div className="navbar-right">
        {/* {ifLogin && (
          <div className="add-medicine">
            <button onClick={handleClick}>Add Medicine</button>
          </div>
        )} */}
        <div className="ai-div">
          <Button className="ai-button" onClick={() => setAskAi(true)}>
            Ask to AI Doctor
          </Button>
        </div>
        <div>
          <label className="switch">
            <span class="sun">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="#ffd43b">
                  <circle r="5" cy="12" cx="12"></circle>
                  <path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z"></path>
                </g>
              </svg>
            </span>
            <span class="moon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                <path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"></path>
              </svg>
            </span>
            <span className="moon">🌙</span>
            <span className="sun">🌞</span>
            <input
              type="checkbox"
              className="input"
              onChange={toggleTheme}
              checked={isDarkMode}
            />
            <span className="slider"></span>
          </label>
        </div>
        <div className="nav-icon-container">
          <Link to="/wishlist">
            <img src={assets.wishlist} alt="Wishlist" className="nav-icon" />
          </Link>
        </div>
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
        {isAuthenticated && (
          <div className="nav-icon-container">
            <button className="nav-btn red" onClick={logout}>
              <img
                src={assets.logout_icon}
                alt="Account"
                className="nav-icon"
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
