import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Clock3, Ticket, UserRound } from "lucide-react";
import { API_BASE_URL } from "../../utils/apiBase";
import "./QueueFullPage.css";

export default function QueueFullPage() {
  const { doctorId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [queueData, setQueueData] = useState(null);
  const [positionData, setPositionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let intervalId = null;

    const loadQueue = async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }
        setError("");

        const displayPromise = axios.get(
          `${API_BASE_URL}/api/queue-v2/display/doctor/${doctorId}`,
        );
        const positionPromise = location.state?.appointmentId
          ? axios.get(`${API_BASE_URL}/api/v2/queue/position/${location.state.appointmentId}`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            })
          : Promise.resolve(null);

        const [displayResponse, positionResponse] = await Promise.all([
          displayPromise,
          positionPromise,
        ]);

        setQueueData(displayResponse.data);
        setPositionData(positionResponse?.data?.data || positionResponse?.data || null);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load full queue.");
      } finally {
        setLoading(false);
      }
    };

    if (doctorId) {
      loadQueue(true);
      intervalId = setInterval(() => loadQueue(false), 5000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [doctorId, location.state?.appointmentId]);

  return (
    <div className="queue-full-page">
      <div className="queue-full-shell">
        <div className="queue-full-header">
          <button type="button" className="queue-full-back" onClick={() => navigate("/dashboard")}>
            <ChevronLeft size={18} strokeWidth={2} />
            Back to Dashboard
          </button>
          <div>
            <p className="queue-full-kicker">Live Queue</p>
            <h1>{location.state?.doctorName || "Doctor Queue"}</h1>
            {!location.state?.doctorName && positionData?.doctor_name ? (
              <p className="queue-full-subtitle">{positionData.doctor_name}</p>
            ) : null}
            <p className="queue-full-subtitle">
              See the current queue order, token progression, and your live position.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="queue-full-empty">Loading full queue…</div>
        ) : error ? (
          <div className="queue-full-empty">{error}</div>
        ) : (
          <>
            <div className="queue-full-summary">
              <div className="queue-full-summary-card">
                <span>Queue Size</span>
                <strong>{queueData?.queue_size ?? 0}</strong>
              </div>
              <div className="queue-full-summary-card">
                <span>Your Position</span>
                <strong>{positionData?.position ?? "—"}</strong>
              </div>
              <div className="queue-full-summary-card">
                <span>Estimated Wait</span>
                <strong>{positionData?.estimated_wait_minutes ?? "—"} min</strong>
              </div>
            </div>

            <div className="queue-full-list">
              {(queueData?.queue || []).length === 0 ? (
                <div className="queue-full-empty">No one is currently in the queue.</div>
              ) : (
                queueData.queue.map((entry, index) => (
                  <article
                    key={`${entry.token_number}-${index}`}
                    className={`queue-full-item ${
                      String(entry.token_number) === String(positionData?.token_number) ? "mine" : ""
                    }`}
                  >
                    <div className="queue-full-token">
                      <Ticket size={18} strokeWidth={2} />
                      <strong>#{entry.token_number}</strong>
                    </div>
                    <div className="queue-full-copy">
                      <h3>Position {entry.position}</h3>
                      <p>Status: {entry.status || "waiting"}</p>
                    </div>
                    <div className="queue-full-badge">
                      <UserRound size={16} strokeWidth={2} />
                      <span>{String(entry.token_number) === String(positionData?.token_number) ? "You" : "Patient"}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
