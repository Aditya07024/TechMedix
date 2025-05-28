import React, { useState } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const Navbar = ({ setShowLogin }) => {
  const [menu, setMenu] = useState("home");
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="navbar">
      <Link to="/">
        <img src={assets.logo} alt="" className="logo" />
      </Link>

      <ul className="navbar-menu">
        <Link
          to="/"
          onClick={() => setMenu("home")}
          className={menu === "home" ? "active" : ""}
        >
          home
        </Link>
        <a
          href="#search-for-medicine"
          onClick={() => setMenu("search-for-medicine")}
          className={menu === "search-for-medicine" ? "active" : ""}
        >
          Search For Medicine
        </a>
        <a
          href="#buy-products"
          onClick={() => setMenu("buy-products")}
          className={menu === "buy-products" ? "active" : ""}
        >
          Buy Products
        </a>
        <a
          href="#health-tips"
          onClick={() => setMenu("health-tips")}
          className={menu === "health-tips" ? "active" : ""}
        >
          Health Tips
        </a>
        <a
          href="#about-us"
          onClick={() => setMenu("about-us")}
          className={menu === "about-us" ? "active" : ""}
        >
          About Us
        </a>
      </ul>
      <div className="navbar-right">
        <div className="add-medicine">
          <button>Add Medicine</button>
        </div>
        <div className="nav-icon-container">
          <button onClick={toggleTheme} className="theme-toggle">
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>
        <div className="nav-icon-container">
          <Link to="/wishlist">
            <img src={assets.wishlist} alt="Wishlist" className="nav-icon" />
          </Link>
        </div>
        <div className="nav-icon-container">
          <button className="nav-btn" onClick={() => setShowLogin(true)}>
            <img src={assets.account_icon} alt="Account" className="nav-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
