import React, { useState } from 'react';
import './LoginPop.css';
import { assets } from '../../assets/assets';
import { useGoogleLogin } from "@react-oauth/google";
import axios from 'axios';

const LoginPop = ({ setShowLogin }) => {
  const [currState, setCurrState] = useState("Sign Up");
  const [error, setError] = useState(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        const res = await axios.post('http://localhost:8080/auth/google', {
          code: response.access_token
        });
        
        // Handle successful login
        console.log("Google login successful:", res.data);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setShowLogin(false);
        
      } catch (err) {
        console.error("Google login failed:", err);
        setError("Failed to login with Google");
      }
    },
    onError: () => {
      setError("Google login failed");
    },
    flow: 'implicit'
  });

  return (
    <div className="pop">
        
      <div className="pop-left">
        <h1>Welcome</h1>
        <h4>User</h4>
      </div>
      <div className="pop-right">
        <div className='login-pop'>
          <form className="login-popup-container" onSubmit={(e) => e.preventDefault()}>
            <div className="login-popup-title">
              <h2>{currState}</h2>
              <div className="cross-img">
                <img 
                    onClick={() => setShowLogin(false)}
                  src={assets.cross_icon} 
                  alt="close"
                />
              </div>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="login-popup-inputs">
              {currState === "Sign Up" && (
                <input type="text" placeholder='Enter your Name' required/>
              )}
              <input type="email" placeholder='Enter your email' required />
              <input type="password" placeholder='Enter your password' required />
            </div>

            <button type="submit">
              {currState === "Sign Up" ? "Create Account" : "Login"}
            </button>

            <div className="login-popup-condition">
              <input type="checkbox" required/>
              <p>By continuing, I agree to the terms of use & privacy policy.</p>
            </div>

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

          <div className="other-login-methods">
            <p>Or continue with</p>
            <div className="other-login-methods-icons">
              <button onClick={googleLogin} className="google-login-btn">
                <img src={assets.google_icon} alt="Google" />
              </button>
              <button className="apple-login-btn">
                <img src={assets.apple_icon} alt="Apple" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPop;