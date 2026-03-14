import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { googleFitAPI } from "../../api/googleFitAPI";
import "./GoogleFitCallback.css";

/**
 * Google Fit OAuth Callback Handler
 * Handles the redirect from Google's OAuth consent screen
 */
export default function GoogleFitCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState(
    "Processing Google Fit authentication...",
  );

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Google authentication failed: ${error}`);
        setTimeout(() => navigate("/dashboard"), 3000);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("No authorization code received from Google");
        setTimeout(() => navigate("/dashboard"), 3000);
        return;
      }

      // Exchange code for tokens
      const response = await googleFitAPI.handleGoogleFitCallback(code);

      if (response.success) {
        setStatus("success");
        setMessage("✓ Google Fit connected successfully! Redirecting...");
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setStatus("error");
        setMessage("Failed to connect Google Fit");
        setTimeout(() => navigate("/dashboard"), 3000);
      }
    } catch (err) {
      console.error("Callback error:", err);
      setStatus("error");
      setMessage("An error occurred during authentication. Please try again.");
      setTimeout(() => navigate("/dashboard"), 3000);
    }
  };

  return (
    <div className="google-fit-callback-container">
      <div className="callback-card">
        {status === "processing" && (
          <div className="callback-content processing">
            <div className="spinner"></div>
            <h2>{message}</h2>
            <p>Please wait while we complete your authentication...</p>
          </div>
        )}

        {status === "success" && (
          <div className="callback-content success">
            <div className="success-icon">✓</div>
            <h2>{message}</h2>
            <p>Your health metrics will start syncing automatically.</p>
          </div>
        )}

        {status === "error" && (
          <div className="callback-content error">
            <div className="error-icon">✕</div>
            <h2>{message}</h2>
            <p>Redirecting to dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
