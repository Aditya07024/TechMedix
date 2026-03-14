import React, { useState, useEffect } from "react";
import { googleFitAPI } from "../../api/googleFitAPI";
import "./GoogleFitConnect.css";

/**
 * Google Fit Connect Component
 * Allows users to connect their Google Fit account
 */
export default function GoogleFitConnect({ onConnected, onDisconnected }) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const status = await googleFitAPI.getGoogleFitStatus();
      setIsConnected(status.connected);
    } catch (err) {
      console.error("Failed to check Google Fit status:", err);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Get the OAuth URL
      const { authUrl } = await googleFitAPI.startGoogleFitAuth();

      // Redirect to Google OAuth consent screen
      window.location.href = authUrl;
    } catch (err) {
      setError("Failed to start Google Fit connection. Please try again.");
      console.error("Connection error:", err);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      await googleFitAPI.disconnectGoogleFit();
      setIsConnected(false);
      setSuccessMessage("Google Fit disconnected successfully");

      if (onDisconnected) {
        onDisconnected();
      }
    } catch (err) {
      setError("Failed to disconnect Google Fit. Please try again.");
      console.error("Disconnection error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="google-fit-connect-container">
      <div className="google-fit-card">
        <div className="google-fit-header">
          <img
            src="https://www.gstatic.com/images/branding/product/1x/fit_logo_48dp.png"
            alt="Google Fit"
            className="google-fit-logo"
          />
          <h3>Google Fit Integration</h3>
        </div>

        <p className="google-fit-description">
          Connect your Google Fit account to automatically sync your health
          metrics like steps, heart rate, sleep duration, and calories burned.
        </p>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Success Message */}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {/* Status */}
        <div className="status-section">
          {isConnected ? (
            <div className="status-connected">
              <span className="status-badge">✓ Connected</span>
              <p>
                Your Google Fit account is connected and syncing health data.
              </p>
            </div>
          ) : (
            <div className="status-disconnected">
              <span className="status-badge">✗ Not Connected</span>
              <p>
                Connect your Google Fit account to start syncing health metrics.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="button-group">
          {isConnected ? (
            <>
              <button
                className="btn btn-disconnect"
                onClick={handleDisconnect}
                disabled={loading}
              >
                {loading ? "Disconnecting..." : "Disconnect Google Fit"}
              </button>
            </>
          ) : (
            <button
              className="btn btn-connect"
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? "Connecting..." : "Connect Google Fit"}
            </button>
          )}
        </div>

        {/* Information */}
        <div className="info-section">
          <h4>What data will be synced?</h4>
          <ul>
            <li>
              <strong>Steps:</strong> Daily step count
            </li>
            <li>
              <strong>Heart Rate:</strong> Average heart rate measurements
            </li>
            <li>
              <strong>Sleep:</strong> Sleep duration and patterns
            </li>
            <li>
              <strong>Calories:</strong> Calories burned
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
