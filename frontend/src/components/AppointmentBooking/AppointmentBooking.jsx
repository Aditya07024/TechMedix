import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { scheduleAPI, appointmentAPI } from "../../api/techmedixAPI";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { assets } from "../../assets/assets";
import { formatTime12Hour } from "../../utils/dateTime";
import "./AppointmentBooking.css";

export default function AppointmentBooking({
  doctorId,
  patientId,
  doctorName,
  doctorSpecialty,
  consultationFee,
}) {
  const SHARE_OPTIONS = [
    { id: "ehr", label: "Medical history and vitals" },
    { id: "prescriptions", label: "Prescriptions" },
    { id: "recordings", label: "Voice notes and recordings" },
    { id: "reports", label: "Reports, PDFs, and uploads" },
  ];
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [shareHistory, setShareHistory] = useState(false);
  const [shareHistoryScope, setShareHistoryScope] = useState(
    SHARE_OPTIONS.map((option) => option.id),
  );
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  /* ============================
     FETCH AVAILABLE DATES
  ============================ */
  useEffect(() => {
    const fetchAvailableDates = async () => {
      // DEBUG IDs log
      console.log("DEBUG IDs:", {
        doctorId,
        patientId,
        doctorId_type: typeof doctorId,
        patientId_type: typeof patientId,
      });
      if (!doctorId) {
        setError("Please select a doctor first");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await scheduleAPI.getAvailableDates(doctorId, 60);
        const dates =
          response.data?.available_dates || response.data?.data || [];

        setAvailableDates(new Set(dates));
      } catch (err) {
        console.error("Error fetching dates:", err);
        setError(err.response?.data?.error || "Failed to load available dates");
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableDates();
  }, [doctorId]);

  /* ============================
     FETCH SLOTS
  ============================ */
  const handleDateSelect = async (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setError(null);

    try {
      setSlotsLoading(true);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const dayVal = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dayVal}`;

      const response = await scheduleAPI.getAvailableSlots(
        doctorId,
        dateStr,
        30,
      );

      const slots = response.data?.slots || response.data?.data || [];

      setAvailableSlots(slots.filter((s) => s.is_available));
    } catch (err) {
      console.error("Slot fetch error:", err);
      setError(err.response?.data?.error || "Failed to load slots");
    } finally {
      setSlotsLoading(false);
    }
  };

  /* ============================
     BOOK APPOINTMENT
  ============================ */
  const handleBookAppointment = async () => {
    if (!selectedSlot) {
      setError("Please select a time slot");
      return;
    }
    console.log("BOOKING DEBUG DETAILS:", {
      doctorId,
      patientId,
      doctorId_type: typeof doctorId,
      patientId_type: typeof patientId,
      selectedDate,
      selectedDate_string: selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}` : "",
      selectedSlot,
      slot_time: selectedSlot?.start_time,
      slot_duration: selectedSlot?.duration_minutes,
    });

    try {
      setLoading(true);
      setError(null);

      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dayVal = String(selectedDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dayVal}`;

      const bookingIntent = {
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_date: dateStr,
        slot_time: selectedSlot.start_time.slice(0, 5),
        share_history: shareHistory,
        share_history_scope: shareHistory ? shareHistoryScope : [],
        doctorName,
        doctorSpecialty,
        consultationFee: Number(consultationFee || 0),
      };

      sessionStorage.setItem("pending-booking-intent", JSON.stringify(bookingIntent));
      setSuccess("Proceed to payment to confirm your appointment.");

      setTimeout(() => {
        navigate("/payment", { state: { bookingIntent } });
      }, 1200);
    } catch (err) {
      console.error("Full booking error:", err);
      console.error("Backend response:", err.response?.data);

      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to book appointment",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     CALENDAR HELPERS
  ============================ */
  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();

  const firstDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  ).getDay();

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
      })
    : null;
  const weekdayLabels = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const normalizedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const renderCalendar = () => {
    const days = [];

    for (let i = 0; i < normalizedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        d,
      );

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const dayVal = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dayVal}`;

      const isAvailable = availableDates.has(dateStr);

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      const isPast = compareDate < todayDate;

      const isSelected = selectedDate && (
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}` === dateStr
      );

      days.push(
        <button
          key={d}
          className={`calendar-day ${
            isAvailable ? "available" : "unavailable"
          } ${isSelected ? "selected" : ""}`}
          disabled={!isAvailable || isPast}
          onClick={() => handleDateSelect(date)}
        >
          {d}
        </button>,
      );
    }

    return days;
  };

  /* ============================
     UI
  ============================ */
  return (
    <div className="appointment-booking-container">
      <div className="booking-title-row">
        <h2 className="booking-title">
          <CalendarDays size={20} strokeWidth={2} />
          <span>Book Appointment</span>
        </h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading && !slotsLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Calendar */}
          <div className="booking-panel">
            <div className="booking-specialist-column">
              <div className="booking-specialist-card">
                <img
                  src={assets.female_avatar}
                  alt="Doctor avatar"
                  className="booking-specialist-avatar"
                />
                <div className="booking-specialist-copy">
                  <strong>{doctorName ? `Dr. ${doctorName}` : "Select specialist"}</strong>
                  <span>{doctorSpecialty || "Doctor"}</span>
                </div>
                <ChevronRight size={18} strokeWidth={2} className="booking-specialist-chevron" />
              </div>

              <div className="booking-specialist-note">
                <div className="booking-specialist-note-title">
                  <ShieldCheck size={15} strokeWidth={2.2} />
                  <span>Top rated care</span>
                </div>
                <p>
                  Highly experienced in preventive cardiology and metabolic health.
                  Patient-first approach with data-driven insights.
                </p>
              </div>
            </div>

            <div className="booking-calendar-column">
              <div className="calendar-header">
                <h3>{monthLabel}</h3>

                <div className="calendar-nav-buttons">
                  <button
                    className="nav-button"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                        ),
                      )
                    }
                  >
                    <ChevronLeft size={18} strokeWidth={2.2} />
                  </button>

                  <button
                    className="nav-button"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                        ),
                      )
                    }
                  >
                    <ChevronRight size={18} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              <div className="calendar-weekdays">
                {weekdayLabels.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid">{renderCalendar()}</div>

              <div className="slot-section">
                <h3 className="slot-title">
                  <Clock3 size={16} strokeWidth={2} />
                  <span>
                    {selectedDateLabel
                      ? `Available Slots (${selectedDateLabel})`
                      : "Available Slots"}
                  </span>
                </h3>

                {selectedDate ? (
                  slotsLoading ? (
                    <p>Loading slots...</p>
                  ) : availableSlots.length > 0 ? (
                    <div className="slot-grid">
                      {availableSlots
                        .filter((slot) => slot.is_available)
                        .map((slot, idx) => (
                          <button
                            key={idx}
                            className={`slot-button ${
                              selectedSlot?.start_time === slot.start_time
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {formatTime12Hour(slot.start_time)}
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p>No available slots for this date</p>
                  )
                ) : (
                  <p>Select an available date to view time slots.</p>
                )}
              </div>
            </div>
          </div>

          <div className="booking-footer">
            <div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={shareHistory}
                  onChange={(e) => setShareHistory(e.target.checked)}
                />
                <span>
                  <ShieldCheck size={16} strokeWidth={2} />
                  Share health history with doctor
                </span>
              </label>

              {shareHistory ? (
                <div className="booking-share-options">
                  {SHARE_OPTIONS.map((option) => (
                    <label key={option.id} className="checkbox-label booking-share-option">
                      <input
                        type="checkbox"
                        checked={shareHistoryScope.includes(option.id)}
                        onChange={(event) => {
                          setShareHistoryScope((current) =>
                            event.target.checked
                              ? [...new Set([...current, option.id])]
                              : current.filter((value) => value !== option.id),
                          );
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="booking-footer-actions">
              <p>Booking for Initial Consultation ({selectedSlot?.duration_minutes || 45} mins)</p>
              <button
                className="book-button"
                disabled={!selectedSlot || loading}
                onClick={handleBookAppointment}
              >
                {loading ? "Processing..." : "Proceed to Payment"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
