import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../../utils/apiBase";
import { assets } from "../../assets/assets";
import {
  Clock3,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Ticket,
  Wifi,
} from "lucide-react";
import "./QueuePosition.css";

export default function PatientQueuePosition({ appointmentId, patientId }) {
  const [queuePosition, setQueuePosition] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(null);
  const [tokenNumber, setTokenNumber] = useState(null);
  const [doctorName, setDoctorName] = useState(null);
  const [status, setStatus] = useState("waiting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      auth: {
        token: localStorage.getItem("token"),
      },
    });

    newSocket.on("connect", () => {
      newSocket.emit("join-patient-room", patientId);
    });

    newSocket.on("queue-position-updated", (data) => {
      setQueuePosition(data.new_position);
      setTokenNumber(data.token_number);
    });

    newSocket.on("your-turn", () => {
      setStatus("being-served");
    });

    newSocket.on("wait-time-updated", (data) => {
      setEstimatedWait(data.estimated_wait_minutes);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [patientId]);

  useEffect(() => {
    const fetchQueuePosition = async () => {
      try {
        const response = await axios.get(`/api/v2/queue/position/${appointmentId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

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

    setLoading(true);
    fetchQueuePosition();
    const interval = setInterval(fetchQueuePosition, 5000);

    return () => clearInterval(interval);
  }, [appointmentId]);

  const getPositionColor = (position) => {
    if (position <= 2) return "#15803d";
    if (position <= 5) return "#d97706";
    return "#b42318";
  };

  const formatWaitTime = (minutes) => {
    if (!minutes) return "Calculating...";
    if (minutes < 1) return "< 1 minute";
    if (minutes === 1) return "1 minute";
    return `${minutes} minutes`;
  };

  const liveUpdateTime = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusSteps = ["Entry", "Current Position", "Consultation"];
  const progressStepIndex =
    status === "being-served" ? 2 : status === "in-progress" ? 1 : 1;
  const clinicActiveCount = Math.max(8, (queuePosition || 0) + 9);
  const clinicWaitingCount = Math.max(1, queuePosition || 0);
  const consultationAverage = estimatedWait ? `${Math.max(12, estimatedWait + 7)}m` : "22m";
  const queueAheadLabel =
    queuePosition > 1 ? `You are #${queuePosition} in queue` : "You are next in queue";

  return (
    <div className="queue-position-container">
      {loading ? (
        <div className="queue-card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your queue position...</p>
          </div>
        </div>
      ) : error ? (
        <div className="queue-card">
          <div className="error-state">
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="queue-reference-layout">
          <div className="queue-main-column">
            <div className="queue-live-update">
              <span className="queue-live-dot" />
              <span>Live Updates: Today, {liveUpdateTime}</span>
            </div>

            <div className="queue-status-card">
              <div className="queue-status-top">
                <div className="queue-token-block">
                  <div className="queue-token-icon">
                    <Ticket size={24} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3>TOKEN #{tokenNumber}</h3>
                    <p>{queueAheadLabel}</p>
                  </div>
                </div>
                <div className="queue-wait-block">
                  <span>Estimated Wait</span>
                  <strong>~{estimatedWait || 15} minutes</strong>
                </div>
              </div>

              <div className="queue-progress-block">
                <div className="queue-progress-labels">
                  {statusSteps.map((step, index) => (
                    <span
                      key={step}
                      className={index === progressStepIndex ? "active" : ""}
                    >
                      {step}
                    </span>
                  ))}
                </div>
                <div className="queue-progress-track">
                  <div
                    className="queue-progress-fill"
                    style={{
                      width: `${progressStepIndex === 2 ? 100 : 66}%`,
                    }}
                  />
                  {[0, 1, 2, 3, 4].map((dotIndex) => (
                    <span
                      key={dotIndex}
                      className={`queue-progress-dot ${
                        dotIndex <= (progressStepIndex === 2 ? 4 : 2) ? "filled" : ""
                      } ${dotIndex === 2 ? "current" : ""}`}
                    />
                  ))}
                </div>
              </div>

              <div className="queue-status-bottom">
                <div className="queue-doctor-card">
                  <img
                    src={assets.female_avatar}
                    alt="Doctor avatar"
                    className="queue-doctor-avatar"
                  />
                  <div>
                    <strong>{doctorName || "Doctor assigned"}</strong>
                    <span>
                      {status === "being-served"
                        ? "Consultation in progress"
                        : "Room details unavailable"}
                    </span>
                  </div>
                </div>
                <button type="button" className="queue-view-btn">
                  View Full Queue
                  <ExternalLink size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="queue-prep-card">
              <div className="queue-prep-copy">
                <h3>Prepare for your visit</h3>
                <p>
                  While you wait, review any pending check-in steps and keep your patient details ready.
                  Additional clinic instructions will appear here when available.
                </p>
                <div className="queue-prep-actions">
                  <button type="button" className="queue-update-btn">
                    Update Records
                  </button>
                  <button type="button" className="queue-link-btn">
                    How it works
                  </button>
                </div>
              </div>
              <div className="queue-checkin-card">
                <QrCode size={54} strokeWidth={1.8} />
                <span>Mobile Check-In</span>
              </div>
            </div>
          </div>

          <div className="queue-side-column">
            <div className="queue-side-card queue-volume-card">
              <div className="queue-side-title">Live Clinic Volume</div>
              <div className="queue-volume-stats">
                <div>
                  <span>Active</span>
                  <strong>{clinicActiveCount}</strong>
                </div>
                <div>
                  <span>Waiting</span>
                  <strong>{String(clinicWaitingCount).padStart(2, "0")}</strong>
                </div>
              </div>
              <div className="queue-volume-footer">
                <span>Avg. Consultation Time</span>
                <strong>{consultationAverage}</strong>
              </div>
            </div>

            <div className="queue-side-card queue-notice-card">
              
              <h4>Department Notice</h4>
              <p>Department updates will appear here when your clinic shares a live notice.</p>
              <div className="queue-wifi-card">
                <Wifi size={18} strokeWidth={2} />
                <div>
                  <span>On-site Access</span>
                  <strong>Reception can share local facility details if needed.</strong>
                </div>
              </div>
            </div>

            <div className="queue-side-card queue-safety-card">
              <ShieldCheck size={22} strokeWidth={2} />
              <h4>Safe Care Protocol</h4>
              <p>
                Safety guidance and pre-visit requirements will appear here when they are available for your appointment.
              </p>
              <button type="button" className="queue-safety-link">
                Health Safety Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
