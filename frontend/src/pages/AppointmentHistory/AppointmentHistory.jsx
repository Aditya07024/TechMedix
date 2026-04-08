import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock3, ChevronLeft, Stethoscope } from "lucide-react";
import { appointmentAPI } from "../../api/techmedixAPI";
import { useAuth } from "../../context/AuthContext";
import "./AppointmentHistory.css";

export default function AppointmentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    const loadAppointments = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await appointmentAPI.getByPatient(user.id);
        setAppointments(response?.data?.data || []);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load appointment history.");
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, [user?.id]);

  const sortedAppointments = appointments
    .slice()
    .sort(
      (a, b) =>
        new Date(`${b.appointment_date} ${b.slot_time || "00:00"}`) -
        new Date(`${a.appointment_date} ${a.slot_time || "00:00"}`),
    );

  return (
    <div className="appointment-history-page">
      <div className="appointment-history-shell">
        <div className="appointment-history-header">
          <button
            type="button"
            className="appointment-history-back"
            onClick={() => navigate("/dashboard")}
          >
            <ChevronLeft size={18} strokeWidth={2} />
            Back to Dashboard
          </button>
          <div>
            <p className="appointment-history-kicker">Patient Journey</p>
            <h1>Appointment History</h1>
            <p className="appointment-history-subtitle">
              View upcoming, completed, cancelled, and rescheduled visits in one place.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="appointment-history-empty">Loading appointment history…</div>
        ) : error ? (
          <div className="appointment-history-empty">{error}</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="appointment-history-empty">No appointments found yet.</div>
        ) : (
          <div className="appointment-history-grid">
            {sortedAppointments.map((appointment) => (
              <article key={appointment.id} className="appointment-history-card">
                <div className="appointment-history-card-head">
                  <div className={`appointment-history-status ${appointment.status || "pending"}`}>
                    {appointment.status || "pending"}
                  </div>
                  <span className="appointment-history-id">
                    {String(appointment.id).slice(0, 8)}
                  </span>
                </div>

                <h3>{appointment.doctor_name || "Doctor Assigned"}</h3>

                <div className="appointment-history-meta">
                  <div>
                    <CalendarDays size={16} strokeWidth={2} />
                    <span>
                      {appointment.appointment_date
                        ? new Date(appointment.appointment_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date unavailable"}
                    </span>
                  </div>
                  <div>
                    <Clock3 size={16} strokeWidth={2} />
                    <span>{appointment.slot_time || "Time unavailable"}</span>
                  </div>
                  <div>
                    <Stethoscope size={16} strokeWidth={2} />
                    <span>{appointment.payment_status || "Payment status unavailable"}</span>
                  </div>
                </div>

                <div className="appointment-history-footer">
                  <span>Doctor ID</span>
                  <strong>{appointment.doctor_id || "Unavailable"}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
