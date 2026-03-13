import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { scheduleAPI, appointmentAPI } from "../../api/techmedixAPI";
import "./AppointmentBooking.css";

export default function AppointmentBooking({ doctorId, patientId }) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [shareHistory, setShareHistory] = useState(false);
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

      const dateStr = date.toISOString().split("T")[0];

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
      selectedDate_string: selectedDate?.toISOString().split("T")[0],
      selectedSlot,
      slot_time: selectedSlot?.start_time,
      slot_duration: selectedSlot?.duration_minutes,
    });

    try {
      setLoading(true);
      setError(null);

      const dateStr = selectedDate.toISOString().split("T")[0];

      const response = await appointmentAPI.book({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: dateStr,
        slot_time: selectedSlot.start_time.slice(0, 5),
        share_history: shareHistory,
      });

      setSuccess("Appointment booked successfully!");

      setTimeout(() => {
        const appointmentId = response.data?.data?.id;
        if (appointmentId) {
          navigate(`/payment/${appointmentId}`);
        } else {
          setError("Failed to get appointment ID. Please try again.");
        }
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

  const renderCalendar = () => {
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        d,
      );

      const dateStr = date.toISOString().split("T")[0];
      const isAvailable = availableDates.has(dateStr);
      const isPast = date < new Date();
      const isSelected = selectedDate?.toISOString().split("T")[0] === dateStr;

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
      <h2>📅 Book Appointment</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading && !slotsLoading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Calendar */}
          <div className="calendar-header">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                  ),
                )
              }
            >
              ←
            </button>

            <h3>{monthLabel}</h3>

            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                  ),
                )
              }
            >
              →
            </button>
          </div>

          <div className="calendar-grid">{renderCalendar()}</div>

          {/* Slots */}
          {selectedDate && (
            <div className="slot-section">
              <h3>Select Time – {selectedDate.toLocaleDateString("en-IN")}</h3>

              {slotsLoading ? (
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
                        {slot.start_time} ({slot.duration_minutes} min)
                      </button>
                    ))}
                </div>
              ) : (
                <p>No available slots for this date</p>
              )}
            </div>
          )}

          {/* Share history */}
          <label>
            <input
              type="checkbox"
              checked={shareHistory}
              onChange={(e) => setShareHistory(e.target.checked)}
            />
            Share health history with doctor
          </label>

          {/* Book button */}
          <button
            className="book-button"
            disabled={!selectedSlot || loading}
            onClick={handleBookAppointment}
          >
            {loading ? "Processing..." : "Proceed to Payment"}
          </button>
        </>
      )}
    </div>
  );
}
