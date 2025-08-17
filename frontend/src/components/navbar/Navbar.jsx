import React, { useState, useEffect } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import Button from '@mui/material/Button';
import Aipop from "../../components/AiPop/Aipop";
import { useNavigate } from 'react-router-dom';
const Navbar = ({setShowLogin}) => {
  const [askAi, setAskAi] = useState(false);
  const [menu, setMenu] = useState("home");
  const { isDarkMode, toggleTheme } = useTheme();
    const [ifLogin, setIfLogin] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    fetch('http://localhost:8080/auth/status', {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        setIfLogin(data.ifLogin);
      })
      .catch(err => {
        setIfLogin(false);
      });
  }, []);

  const handleClick = () => {
    navigate('/new');
  };
    const logout = async () => {
    try {
      await fetch('http://localhost:8080/auth/logout', {
        method: 'GET',
        credentials: 'include',
      });
      setIfLogin(false);
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="navbar">
            {askAi && <Aipop setShowAiPop={setAskAi} />}

      <Link to="/">
        <img src={assets.logo} alt="" className="logo" />
      </Link>

      <ul className="navbar-menu">
        <Link
          to="/home"
          onClick={() => setMenu("home")}
          className={menu === "home" ? "active" : ""}
        >
          home
        </Link>
        <Link to="/search"
          onClick={() => setMenu("search-for-medicine")}
          className={menu === "search-for-medicine" ? "active" : ""}>
            Search for medicine
        </Link>
        
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
        {ifLogin && (
          <div className="add-medicine">
            <button onClick={handleClick}>Add Medicine</button>
          </div>
        )}
        <div className="ai-div">
          <Button className="ai-button" onClick={() => setAskAi(true)}>Ask to ChatGpt
              <img className="chatgpt" src={assets.chatgpt} alt="" />
            </Button>
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
        {!ifLogin && (
        <div className="nav-icon-container">
          <button className="nav-btn" onClick={() => setShowLogin(true)}>
            <img src={assets.account_icon} alt="Account" className="nav-icon" />
          </button>
        </div>)}
        {ifLogin && (
        <div className="nav-icon-container">
          <button className="nav-btn red" onClick={logout}>
                        <img src={assets.logout_icon} alt="Account" className="nav-icon" />

          </button>
        </div>)}
      </div>
    </div>
  );
};

export default Navbar;
