import React, { useState } from 'react'
import './LoginPop.css';
import { assets } from '../../assets/assets';

const LoginPop = ({setShowLogin}) => {
    const [currState, setCurrState] = useState("Sign Up")
  return (
    <div className="pop">
        <div className="pop-left">
            <h1>Welcome</h1>
            <h4>Your Name</h4>
        </div>
        <div className="pop-right">
            <div className='login-pop'>
        <form className="login-popup-container">
            <div className="login-popup-title">
                <h2>{currState}</h2>
                <div className="cross-img"></div>
                <img onClick={()=>setShowLogin(false)} src={assets.cross_icon} alt=""></img>
            </div>
            <div className="login-popup-inputs">
                {currState==="Login"?<></>:<input type="text" placeholder='Enter your Name' required/>}
                <input type="email" placeholder='Enter your email' required />
                <input type="password" placeholder='Enter your password' />
            </div>
            <button>{currState==="Sign Up"?"Create Account":"Login"}</button>
            <div className="login-popup-condition">
                <input type="checkbox" required/>
                <p>By contiuning, i agree to the terms of use & privacy policy.</p>
            </div>
            {currState==="Login"?<p>Create a new account? <span onClick={()=>setCurrState("Sign Up")}>Cick here</span></p>:<p>Already have an account<span onClick={()=>setCurrState("Login")}> Login here</span></p>}
        </form>
        <div className="other-login-methods">
            <p>Or</p>
            <div className="other-login-methods-icons">
                <img src={assets.google_icon} alt="Google" />
                <img src={assets.facebook_icon} alt="Facebook" />
                <img src={assets.apple_icon} alt="Apple" />
            </div>
        </div>
    </div>
        </div>
    </div>
    
  )
}

export default LoginPop