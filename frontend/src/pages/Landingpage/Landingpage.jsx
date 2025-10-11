import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landingpage.css";
import landingVideo from "../../assets/landingvideo.mp4";

// import landingvideo from '../../assets/landingvideo'
const Landingpage = () => {
  const navigate = useNavigate();
  const useapp = () => {
    navigate("/home");
  };
  return (
    <>
      <div className="hero-section">
        <video autoPlay loop muted playsInline>
          <source src={landingVideo} type="video/mp4" />
        </video>
        <div className="hero-text">
          <h1>Welcome to TechMedix</h1>
          <p>Your health, our priority.</p>
          <div onClick={useapp} class="container">
            <a href="#" class="button type--C">
              <div class="button__line"></div>
              <div class="button__line"></div>
              <span class="button__text">CLICK HERE</span>
              <div class="button__drow1"></div>
              <div class="button__drow2"></div>
            </a>
          </div>
          <div
            onClick={() => navigate("/doctor/login")}
            class="container"
            style={{ marginTop: "20px" }}
          >
            <a href="#" class="button type--C">
              <div class="button__line"></div>
              <div class="button__line"></div>
              <span class="button__text">DOCTOR LOGIN</span>
              <div class="button__drow1"></div>
              <div class="button__drow2"></div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Landingpage;
