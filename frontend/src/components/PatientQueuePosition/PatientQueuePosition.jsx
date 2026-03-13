import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

/**
 * PATIENT QUEUE POSITION COMPONENT
 * Real-time queue position and wait time tracking
 * Uses Socket.IO for live updates
 */
export default function PatientQueuePosition({ appointmentId, patientId }) {
  const [queuePosition, setQueuePosition] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(null);
  const [tokenNumber, setTokenNumber] = useState(null);
  const [doctorName, setDoctorName] = useState(null);
  const [status, setStatus] = useState("waiting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(
  import.meta.env.VITE_API_URL || "http://localhost:8080",
  {
    auth: {
      token: localStorage.getItem("token"),
    },
  }
);

    newSocket.on("connect", () => {
      console.log("Connected to queue service");
      // Join patient room for queue updates
      newSocket.emit("join-patient-room", patientId);
    });

    // Listen for queue position updates
    newSocket.on("queue-position-updated", (data) => {
      setQueuePosition(data.new_position);
      setTokenNumber(data.token_number);
    });

    // Listen for "your turn" notification
    newSocket.on("your-turn", (data) => {
      setStatus("being-served");
      console.log(data.message);
    });

    // Listen for estimated wait time updates
    newSocket.on("wait-time-updated", (data) => {
      setEstimatedWait(data.estimated_wait_minutes);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [patientId]);

  // Fetch initial queue position + polling updates
  useEffect(() => {
    const fetchQueuePosition = async () => {
      try {
        const response = await axios.get(
          `/api/v2/queue/position/${appointmentId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        const queue = response.data.data || {};

        setQueuePosition(queue.position ?? 0);
        setTokenNumber(queue.token_number ?? "-");
        setEstimatedWait(queue.estimated_wait_minutes ?? 0);
        setDoctorName(queue.doctor_name ?? null);
        setStatus(queue.status ?? "waiting");
        setError(null);
      } catch (err) {
        console.error("Queue fetch failed:", err);
        setError("Failed to load queue position");
      } finally {
        setLoading(false);
      }
    };

    // initial load
    setLoading(true);
    fetchQueuePosition();

    // poll every 5 seconds so queue updates even without socket
    const interval = setInterval(fetchQueuePosition, 5000);

    return () => clearInterval(interval);
  }, [appointmentId]);

  const getPositionColor = (position) => {
    if (position <= 2) return "#10b981"; // Green - Soon
    if (position <= 5) return "#f59e0b"; // Amber - Wait
    return "#ef4444"; // Red - Long wait
  };

  const formatWaitTime = (minutes) => {
    if (!minutes) return "Calculating...";
    if (minutes < 1) return "< 1 minute";
    if (minutes === 1) return "1 minute";
    return `${minutes} minutes`;
  };

  return (
    <div className="queue-position-container">
      <div className="queue-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your queue position...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>⚠️ {error}</p>
          </div>
        ) : (
          <>
            {/* Token and Position */}
            <div className="token-section">
              <div className="token-number">
                <div className="token-label">Your Token</div>
                <div className="token-value">{tokenNumber}</div>
              </div>

              <div className="position-section">
                <div className="position-label">Queue Position</div>
                <div
                  className="position-circle"
                  style={{ backgroundColor: getPositionColor(queuePosition) }}
                >
                  {queuePosition}
                </div>
              </div>
            </div>

            {/* Wait Time */}
            <div className="wait-time-section">
              <div className="wait-label">Estimated Wait Time</div>
              <div className="wait-time">{formatWaitTime(estimatedWait)}</div>
            </div>

            {/* Doctor Info */}
            {doctorName && (
              <div className="doctor-info">
                <strong>Doctor:</strong> {doctorName}
              </div>
            )}

            {/* Status Indicator */}
            <div className={`status-indicator ${status}`}>
              {status === "waiting" && (
                <>
                  <span className="status-dot"></span>
                  <span>Waiting for your turn</span>
                </>
              )}
              {status === "in-progress" && (
                <>
                  <span className="status-dot active"></span>
                  <span>Almost there! Sit tight</span>
                </>
              )}
              {status === "being-served" && (
                <>
                  <span className="status-dot success"></span>
                  <span>🎉 Your turn! Please report to the doctor</span>
                </>
              )}
            </div>

            {/* Queue Tips */}
            <div className="queue-tips">
              <p>
                💡 <strong>Tip:</strong> Keep your phone handy to receive
                instant notifications when you're called.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="progress-info">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.max((queuePosition / 10) * 100, 5)}%`,
                  }}
                ></div>
              </div>
              <p className="progress-text">
                {queuePosition > 1
                  ? `${queuePosition - 1} ahead of you`
                  : "You are next!"}
              </p>
            </div>
          </>
        )}
      </div>

      <style>{`
        .queue-position-container {
          max-width: 600px;
          margin: 20px auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .queue-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .loading-state,
        .error-state {
          text-align: center;
          padding: 40px 20px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-state {
          color: #991b1b;
          background: #fee2e2;
          border-radius: 8px;
          padding: 20px;
        }

        .token-section {
          display: flex;
          justify-content: space-around;
          margin-bottom: 30px;
          gap: 20px;
        }

        .token-number,
        .position-section {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .token-label,
        .position-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .token-value {
          font-size: 48px;
          font-weight: bold;
          color: #1f2937;
        }

        .position-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .wait-time-section {
          text-align: center;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .wait-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .wait-time {
          font-size: 28px;
          color: #f59e0b;
          font-weight: 600;
        }

        .doctor-info {
          text-align: center;
          padding: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          color: #1f2937;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-indicator.waiting {
          background: #dbeafe;
          color: #1e40af;
        }

        .status-indicator.in-progress {
          background: #fef3c7;
          color: #92400e;
        }

        .status-indicator.being-served {
          background: #dcfce7;
          color: #15803d;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
          animation: pulse 2s infinite;
        }

        .status-dot.active {
          animation: pulse-active 1s infinite;
        }

        .status-dot.success {
          animation: none;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes pulse-active {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        .queue-tips {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 13px;
          line-height: 1.5;
        }

        .queue-tips p {
          margin: 0;
          color: #78350f;
        }

        .progress-info {
          margin-top: 20px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #6b7280;
          text-align: center;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
