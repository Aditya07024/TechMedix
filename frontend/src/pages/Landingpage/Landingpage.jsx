import React from 'react'
import { useNavigate } from 'react-router-dom';
import "./Landingpage.css"
import landingVideo from '../../assets/landingvideo.mp4';

// import landingvideo from '../../assets/landingvideo'
const Landingpage = () => {
    const navigate = useNavigate();
    const useapp = () => {
        navigate("/home");
    }
    return (
        <>
            <div className='hero-section'>
  <video autoPlay loop muted playsInline>
  <source src={landingVideo} type="video/mp4" />
  </video>
  <div className="hero-text">
    <h1>Welcome to TechMedix</h1>
    <p>Your health, our priority.</p>
    <button onClick={useapp}>Click Here</button>
  </div>
</div>
        </>
    )
}

export default Landingpage