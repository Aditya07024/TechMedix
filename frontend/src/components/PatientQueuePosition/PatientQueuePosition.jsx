import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { API_BASE_URL } from "../../utils/apiBase";
import { formatTime12Hour } from "../../utils/dateTime";
import { useNavigate } from "react-router-dom";
import { assets } from "../../assets/assets";
import { queueAPI } from "../../api/techmedixAPI";
import {
  Clock3,
  ExternalLink,
  House,
  ShieldCheck,
  Ticket,
  TimerReset,
  Users,
  Wifi,
} from "lucide-react";
import "./QueuePosition.css";

const ARRIVAL_BUFFER_MINUTES = 15;

function parseAppointmentDateTime(appointmentDate, slotTime) {
  if (!appointmentDate || !slotTime) return null;

  const normalizedTime = String(slotTime).slice(0, 5);
  const parsed = new Date(`${appointmentDate}T${normalizedTime}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIsoDateTime(value) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatClockTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "--";
  return formatTime12Hour(value.toISOString(), "--");
}

function formatMinutesUntil(value) {
  if (!Number.isFinite(value)) return "";
  if (value <= 0) return "Leave now";
  if (value < 60) return `Leave in ${Math.ceil(value)} min`;

  const hours = Math.floor(value / 60);
  const minutes = Math.ceil(value % 60);
  return minutes > 0
    ? `Leave in ${hours}h ${minutes}m`
    : `Leave in ${hours}h`;
}

function formatWaitTime(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return "Calculating...";
  if (Number(minutes) < 1) return "< 1 minute";
  if (Number(minutes) === 1) return "1 minute";
  return `${Math.round(Number(minutes))} minutes`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

export default function PatientQueuePosition({
  appointmentId,
  patientId,
  appointmentDate,
  slotTime,
  appointmentStatus,
  doctorName: initialDoctorName = null,
  doctorId: initialDoctorId = null,
}) {
  const mobileCheckInQrUrl =
    "https://drive.google.com/uc?export=download&id=1lrCdWHnf_6N5ZcSrMPA7uUrT4lnrCfEQ";
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(false);
  const inFlightRequestRef = useRef(null);

  const applyQueueStatus = (data = {}) => {
    setQueueStatus((prev) => ({
      ...prev,
      ...data,
    }));
    setError(null);
  };

  const fetchQueueStatus = async ({ silent = false } = {}) => {
    if (!appointmentId) {
      setQueueStatus(null);
      setLoading(false);
      return;
    }

    if (inFlightRequestRef.current) {
      return inFlightRequestRef.current;
    }

    if (!silent) {
      setLoading(true);
    }

    const request = queueAPI
      .getPosition(appointmentId)
      .then((response) => {
        if (!isMountedRef.current) return;
        applyQueueStatus(response.data.data || {});
      })
      .catch((err) => {
        if (!isMountedRef.current || axios.isCancel(err)) {
          return;
        }

        if (err.code === "ECONNABORTED") {
          setError((prev) =>
            queueStatus
              ? prev
              : "Queue update is taking longer than expected. Retrying automatically.",
          );
          return;
        }

        console.error("Queue fetch failed:", err);
        setError("Failed to load queue status");
      })
      .finally(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
        inFlightRequestRef.current = null;
      });

    inFlightRequestRef.current = request;

    try {
      await request;
    } catch {
      // Errors are handled in the request chain above.
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setQueueStatus({
      appointment_id: appointmentId,
      appointment_date: appointmentDate,
      scheduled_time: slotTime,
      status: appointmentStatus || "booked",
      doctor_name: initialDoctorName,
      doctor_id: initialDoctorId,
      checked_in: ["arrived", "in_progress", "in-progress"].includes(
        String(appointmentStatus || "").toLowerCase(),
      ),
      queue_mode: ["arrived", "in_progress", "in-progress"].includes(
        String(appointmentStatus || "").toLowerCase(),
      )
        ? "live_queue"
        : "pre_checkin",
    });
  }, [
    appointmentDate,
    appointmentId,
    appointmentStatus,
    initialDoctorId,
    initialDoctorName,
    slotTime,
  ]);

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
      if (String(data?.appointment_id) !== String(appointmentId)) {
        return;
      }

      applyQueueStatus(data);
    });

    newSocket.on("your-turn", (data) => {
      if (data?.appointment_id && String(data.appointment_id) !== String(appointmentId)) {
        return;
      }

      applyQueueStatus({
        status: "in_progress",
        checked_in: true,
        queue_mode: "live_queue",
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [appointmentId, patientId]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const pollQueueStatus = async (isInitial = false) => {
      if (cancelled) return;
      await fetchQueueStatus({ silent: !isInitial });
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        pollQueueStatus(false);
      }, 30000);
    };

    pollQueueStatus(true);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [appointmentId]);

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      await queueAPI.markArrived(appointmentId);
      await fetchQueueStatus();
    } catch (err) {
      console.error("Check-in failed:", err);
      setError(err?.response?.data?.error || "Failed to check in");
    } finally {
      setCheckingIn(false);
    }
  };

  const scheduledAppointmentTime = parseAppointmentDateTime(appointmentDate, slotTime);
  const predictedAppointmentTime =
    parseIsoDateTime(queueStatus?.expected_consultation_time) || scheduledAppointmentTime;
  const leaveByTime =
    parseIsoDateTime(queueStatus?.leave_for_clinic_at) ||
    (predictedAppointmentTime
      ? new Date(predictedAppointmentTime.getTime() - ARRIVAL_BUFFER_MINUTES * 60 * 1000)
      : null);
  const minutesUntilLeave = leaveByTime
    ? (leaveByTime.getTime() - Date.now()) / (60 * 1000)
    : null;
  const leaveStatusLabel = formatMinutesUntil(minutesUntilLeave);
  const expectedAppointmentLabel = formatClockTime(predictedAppointmentTime);
  const leaveByLabel = formatClockTime(leaveByTime);
  const checkedIn = Boolean(queueStatus?.checked_in);
  const queueMode = queueStatus?.queue_mode || (checkedIn ? "live_queue" : "pre_checkin");
  const doctorName = queueStatus?.doctor_name || initialDoctorName || "Doctor assigned";
  const doctorId = queueStatus?.doctor_id || initialDoctorId || null;
  const tokenNumber = queueStatus?.token_number ?? "--";
  const peopleAhead = Number(queueStatus?.people_ahead ?? 0);
  const queuePosition = queueStatus?.position ?? (checkedIn ? peopleAhead + 1 : null);
  const estimatedWait = Number(queueStatus?.estimated_wait_minutes ?? 0);
  const avgConsultationMinutes = Number(queueStatus?.avg_consultation_minutes ?? 0);
  const doctorDelayMinutes = Number(queueStatus?.doctor_delay_minutes ?? 0);
  const status = queueStatus?.status || appointmentStatus || "booked";
  const normalizedStatus = String(status || "").toLowerCase();
  const isInConsultation = ["in_progress", "in-progress", "being-served", "completed"].includes(
    normalizedStatus,
  );
  const queueProgressPercent = !checkedIn
    ? 0
    : isInConsultation
      ? 100
      : peopleAhead <= 0
        ? 84
        : clamp(Math.round(84 / (peopleAhead + 1)), 18, 72);
  const queueProgressMessage = !checkedIn
    ? "Check in to start live queue tracking."
    : isInConsultation
      ? "It is your turn now."
      : peopleAhead <= 0
        ? "You are next."
        : `${peopleAhead} ${peopleAhead === 1 ? "person is" : "people are"} ahead of you.`;
  const appointmentIsToday = appointmentDate === getTodayIsoDate();
  const canCheckIn = !checkedIn && appointmentIsToday;
  const plannerTitle =
    queueMode === "live_queue"
      ? "Your likely consultation timing"
      : "Leave-home plan before check-in";
  const plannerBadge =
    leaveStatusLabel || (queueMode === "live_queue" ? "Calculating" : "Scheduled visit");
  const queueAheadLabel =
    queueMode === "live_queue"
      ? peopleAhead > 0
        ? `${peopleAhead} people ahead of you`
        : "You are next in queue"
      : "Prediction based on today’s schedule and live clinic pace";
  const liveUpdateTime = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const leaveAdvice =
    minutesUntilLeave == null
      ? "We will keep recalculating your leave window as the queue changes."
      : minutesUntilLeave <= 0
        ? `Leave now to reach around ${ARRIVAL_BUFFER_MINUTES} minutes before your consultation.`
        : `Plan to leave by ${leaveByLabel} so you arrive about ${ARRIVAL_BUFFER_MINUTES} minutes early.`;
  const prepCopy = canCheckIn
    ? "You can check in now from home or once you reach the clinic. After check-in, we switch to the live checked-in queue for tighter predictions."
    : queueMode === "live_queue"
      ? "You are now in the live clinic queue. We will keep adjusting your time using check-ins, completed consultations, and doctor delays."
      : "Check-in opens on the day of your appointment. Your departure suggestion is already being estimated from the doctor’s live queue trend.";
  const clinicActiveCount = Math.max(1, peopleAhead + (checkedIn ? 1 : 0));
  const clinicWaitingCount = Math.max(0, peopleAhead);
  const consultationAverage = avgConsultationMinutes
    ? `${Math.round(avgConsultationMinutes)}m`
    : "Calculating";

  return (
    <div className="queue-position-container">
      {loading ? (
        <div className="queue-card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your queue status...</p>
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
                    <h3>{checkedIn ? `TOKEN #${tokenNumber}` : "APPOINTMENT PLAN"}</h3>
                    <p>{queueAheadLabel}</p>
                  </div>
                </div>
                <div className="queue-wait-block">
                  <span>{checkedIn ? "Estimated Wait" : "Expected Visit"}</span>
                  <strong>
                    {checkedIn ? formatWaitTime(estimatedWait) : expectedAppointmentLabel}
                  </strong>
                </div>
              </div>

              {checkedIn && (
                <div className="queue-progress-block">
                  <div className="queue-progress-labels">
                    <span className="active">Checked in</span>
                    <span>{queueProgressMessage}</span>
                    <span>{isInConsultation ? "With doctor" : "Consultation"}</span>
                  </div>
                  <div className="queue-progress-track">
                    <div
                      className="queue-progress-fill"
                      style={{
                        width: `${queueProgressPercent}%`,
                      }}
                    />
                    <span className="queue-progress-dot queue-progress-dot--start filled" />
                    <span
                      className={`queue-progress-dot queue-progress-dot--marker ${
                        isInConsultation ? "current" : ""
                      }`}
                      style={{
                        left: `${queueProgressPercent}%`,
                      }}
                    />
                    <span
                      className={`queue-progress-dot queue-progress-dot--end ${
                        isInConsultation ? "filled current" : ""
                      }`}
                    />
                  </div>
                  <div className="queue-progress-caption">
                    <strong>{queueProgressMessage}</strong>
                    <span>
                      {isInConsultation
                        ? "Proceed to consultation."
                        : estimatedWait > 0
                          ? `About ${formatWaitTime(estimatedWait)} remaining.`
                          : "We will keep updating this as the queue moves."}
                    </span>
                  </div>
                </div>
              )}

              <div className="queue-travel-card">
                <div className="queue-travel-header">
                  <div>
                    <span className="queue-side-title">Departure Planner</span>
                    <h4>{plannerTitle}</h4>
                  </div>
                  <div className="queue-travel-pill">{plannerBadge || "Calculating"}</div>
                </div>

                <div className="queue-travel-metrics">
                  <div className="queue-travel-metric">
                    <div className="queue-travel-icon">
                      <TimerReset size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <span>Expected appointment</span>
                      <strong>{expectedAppointmentLabel}</strong>
                    </div>
                  </div>

                  <div className="queue-travel-metric">
                    <div className="queue-travel-icon">
                      <House size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <span>Leave home by</span>
                      <strong>{leaveByLabel}</strong>
                    </div>
                  </div>

                  <div className="queue-travel-metric">
                    <div className="queue-travel-icon">
                      <Users size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <span>People ahead</span>
                      <strong>{peopleAhead}</strong>
                    </div>
                  </div>
                </div>

                <p className="queue-travel-note">{leaveAdvice}</p>
              </div>

              <div className="queue-status-bottom">
                <div className="queue-doctor-card">
                  <img
                    src={assets.female_avatar}
                    alt="Doctor avatar"
                    className="queue-doctor-avatar"
                  />
                  <div>
                    <strong>{doctorName}</strong>
                    <span>
                      {status === "in_progress"
                        ? "Consultation in progress"
                        : checkedIn
                          ? `Position ${queuePosition || "--"} in live queue`
                          : appointmentIsToday
                            ? "Prediction will tighten after check-in"
                            : "Visit planned for your booked slot"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="queue-view-btn"
                  onClick={() =>
                    navigate(`/queue/${doctorId}`, {
                      state: {
                        appointmentId,
                        doctorName,
                      },
                    })
                  }
                  disabled={!doctorId}
                >
                  View Full Queue
                  <ExternalLink size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="queue-prep-card">
              <div className="queue-prep-copy">
                <h3>Prepare for your visit</h3>
                <p>{prepCopy}</p>
                <div className="queue-prep-actions">
                  {canCheckIn ? (
                    <button
                      type="button"
                      className="queue-checkin-action"
                      onClick={handleCheckIn}
                      disabled={checkingIn}
                    >
                      {checkingIn ? "Checking in..." : "Check In Now"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="queue-update-btn"
                      onClick={() => navigate("/form")}
                    >
                      Update Records
                    </button>
                  )}
                  <button
                    type="button"
                    className="queue-link-btn"
                    onClick={() => navigate("/appointments/history")}
                  >
                    Appointment Details
                  </button>
                </div>
              </div>
              <div className="queue-checkin-card">
                <img
                  src={assets.techmedix_apk_qr}
                  alt="Mobile check-in QR code"
                  className="queue-checkin-qr"
                />
                <button
                  type="button"
                  className="queue-checkin-link"
                  onClick={() => window.open(mobileCheckInQrUrl, "_blank", "noopener,noreferrer")}
                >
                  Download Mobile app
                  <ExternalLink size={16} strokeWidth={2} />
                </button>
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
              <p>
                {doctorDelayMinutes > 0
                  ? `Doctor is currently running about ${doctorDelayMinutes} minutes late. Your ETA has been adjusted automatically.`
                  : "No current delay notice from the clinic. Predictions are tracking the live queue pace."}
              </p>
              <div className="queue-wifi-card">
                <Clock3 size={18} strokeWidth={2} />
                <div>
                  <span>Expected arrival window</span>
                  <strong>{`Leave by ${leaveByLabel} for an expected visit around ${expectedAppointmentLabel}.`}</strong>
                </div>
              </div>
            </div>

            <div className="queue-side-card queue-safety-card">
              <ShieldCheck size={22} strokeWidth={2} />
              <h4>Safe Care Protocol</h4>
              <p>
                Keep your phone available. We can adjust your prediction in real time if the doctor is delayed, consultations run long, or the queue clears faster.
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
