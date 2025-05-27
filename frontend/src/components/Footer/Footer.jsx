import React from 'react'
import './Footer.css';
import { assets } from '../../assets/assets';

const Footer = () => {
  return (
    <div className='footer' id='footer'>
      <div className="footer-content">
        <div className="footer-content-left">
          <img src={assets.logo} alt="TechMedix Logo" className="footer-logo" />
          <p>Stay tuned for latest updates and new features</p>
          <form className="mail-box">
            <input
              type="email"
              className="email-box"
              placeholder="Email address"
              required
            />
            <button type="submit" className="subscribe-btn">
              Subscribe
            </button>
          </form>
          <div className="checkbox-row">
            <input type="checkbox" id="terms" className="checkbox" />
            <label htmlFor="terms">
              I accept terms and conditions &amp; privacy policy
            </label>
          </div>
        </div>
        <div className="footer-content-center">
          <div>
            <h2>Information</h2>
            <ul>
              <li>About us</li>
              <li>Privacy Policy</li>
              <li>Terms &amp; Conditions</li>
            </ul>
          </div>
          <div>
            <h2>Account</h2>
            <ul>
              <li>Dashboard</li>
              <li>Account details</li>
              <li>Wishlist</li>
            </ul>
          </div>
        </div>
        <div className="footer-content-right">
          <h2>About / Contacts</h2>
          <div className="footer-contact-row">
            <span className="contact-icon">✉️</span>
            <span>Techmedix@gmail.com</span>
          </div>
          <div className="footer-social-row">
            <a href="#"><img src={assets.facebook} alt=""></img></a>
            <a href="#"><img src={assets.instagram} alt=""></img></a>
            <a href="#"><img src={assets.twitter} alt=""></img></a>
            <a href="#"><img src={assets.linkedin} alt=""></img></a>
            <a href="#"><img src={assets.youtube} alt=""></img></a>
          </div>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">
        Copyright 2024 @ TechMedix - All Rights Reserved.
      </p>
    </div>
  )
}

export default Footer