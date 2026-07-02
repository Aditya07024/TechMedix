import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock3, ChevronLeft, Stethoscope } from "lucide-react";
import { appointmentAPI, reviewAPI } from "../../api/techmedixAPI";
import { useAuth } from "../../context/AuthContext";
import { formatTime12Hour } from "../../utils/dateTime";
import "./AppointmentHistory.css";

export default function AppointmentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [patientReviews, setPatientReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    const loadAppointmentsAndReviews = async () => {
      try {
        setLoading(true);
        setError("");
        const [apptRes, reviewRes] = await Promise.allSettled([
          appointmentAPI.getByPatient(user.id),
          reviewAPI.getPatientReviews(),
        ]);

        if (apptRes.status === "fulfilled") {
          setAppointments(apptRes.value?.data?.data || []);
        }
        if (reviewRes.status === "fulfilled") {
          setPatientReviews(reviewRes.value?.data?.reviews || []);
        }
      } catch (err) {
        setError("Failed to load appointment history.");
      } finally {
        setLoading(false);
      }
    };

    loadAppointmentsAndReviews();
  }, [user?.id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApt) return;

    try {
      setSubmittingReview(true);
      await reviewAPI.createReview({
        doctor_id: selectedApt.doctor_id,
        appointment_id: selectedApt.id,
        rating: reviewRating,
        comment: reviewComment,
      });

      alert("Thank you for your feedback! Review submitted successfully.");
      setShowReviewModal(false);
      setReviewComment("");
      setReviewRating(5);
      
      // Reload reviews
      const reviewRes = await reviewAPI.getPatientReviews();
      setPatientReviews(reviewRes.data?.reviews || []);
    } catch (err) {
      alert("Failed to submit review: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

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
                    <span>{formatTime12Hour(appointment.slot_time, "Time unavailable")}</span>
                  </div>
                  <div>
                    <Stethoscope size={16} strokeWidth={2} />
                    <span>{appointment.payment_status || "Payment status unavailable"}</span>
                  </div>
                </div>

                {appointment.clinic_address && (
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '1rem', marginTop: '-2px' }}>📍</span>
                    <span><strong>Clinic Address:</strong> {appointment.clinic_address}</span>
                  </div>
                )}

                <div className="appointment-history-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Doctor ID</span>
                    <strong>{appointment.doctor_id || "Unavailable"}</strong>
                  </div>
                  {(appointment.status === "completed" || appointment.status === "visited") && (
                    <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      {patientReviews.some(r => r.appointment_id === appointment.id) ? (
                        <span style={{ color: '#0b7a72', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          Reviewed (★ {patientReviews.find(r => r.appointment_id === appointment.id)?.rating})
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApt(appointment);
                            setShowReviewModal(true);
                          }}
                          style={{
                            padding: '4px 10px',
                            background: '#0b7a72',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}
                        >
                          Rate & Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showReviewModal && selectedApt && (
        <div className="dashboard-modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowReviewModal(false)}>
          <div className="dashboard-modal-card" style={{ background: '#fff', padding: '35px', borderRadius: '12px', maxWidth: '450px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="section-kicker" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0b7a72' }}>Feedback</span>
                <h3 style={{ margin: '5px 0 0 0', fontSize: '1.25rem', color: '#10203a' }}>Review Dr. {selectedApt.doctor_name || 'Assigned Doctor'}</h3>
              </div>
              <button type="button" onClick={() => setShowReviewModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6d7985' }}>×</button>
            </div>
            
            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Rating</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.8rem',
                        cursor: 'pointer',
                        color: star <= reviewRating ? '#ffc107' : '#e4e5e9',
                        padding: 0
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10203a' }}>Comments</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with this specialist..."
                  rows={4}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0b7a72', color: '#fff', cursor: submittingReview ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
