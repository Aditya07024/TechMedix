import React, { useState, useEffect } from "react";
import { scheduleAPI } from "../../api/techmedixAPI";
import "./DoctorScheduleManager.css";

const DAYS_OF_WEEK = [
  { id: 0, name: "Sunday" },
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

export default function DoctorScheduleManager({ doctorId }) {
  // Ensure we always use UUID doctorId (backend now uses UUID)
  const doctorUUID = doctorId || localStorage.getItem("doctorId");

  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedDayId, setExpandedDayId] = useState(null);

  const toggleDayDetails = (dayId) => {
    setExpandedDayId((prev) => (prev === dayId ? null : dayId));
  };

  // Initialize schedule
  useEffect(() => {
    const initSchedule = {};
    DAYS_OF_WEEK.forEach((day) => {
      initSchedule[day.id] = {
        day_of_week: day.id,
        start_time: "09:00",
        end_time: "17:00",
        consultation_duration: 30,
        is_active: day.id >= 1 && day.id <= 5,
      };
    });

    setSchedule(initSchedule);

    if (doctorUUID) {
      fetchSchedule();
    }
  }, [doctorUUID]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await scheduleAPI.getDoctorSchedule(doctorUUID);
      const scheduleData = response.data?.data || [];

      const scheduleMap = {};
      scheduleData.forEach((item) => {
        scheduleMap[item.day_of_week] = {
          ...item,
          // Map database column to frontend field name
          consultation_duration: Number(
            item.consultation_duration_minutes ||
              item.consultation_duration ||
              30,
          ),
          consultation_duration_minutes: Number(
            item.consultation_duration_minutes ||
              item.consultation_duration ||
              30,
          ),
          is_active: true,
        };
      });

      setSchedule((prev) => ({
        ...prev,
        ...scheduleMap,
      }));
    } catch (err) {
      console.error("Fetch schedule error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (dayId, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        [field]: value,
      },
    }));
  };

  const toggleDayActive = (dayId) => {
    setSchedule((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        is_active: !prev[dayId].is_active,
      },
    }));
  };

  const validateSchedule = () => {
    if (!doctorUUID) {
      setError("❌ Doctor ID missing. Please login again.");
      return false;
    }

    const activeDays = Object.values(schedule).filter((day) => day.is_active);

    if (activeDays.length === 0) {
      setError("❌ Please select at least one working day.");
      return false;
    }

    for (const day of activeDays) {
      if (!day.start_time || !day.end_time || !day.consultation_duration) {
        setError(`❌ Missing fields in ${DAYS_OF_WEEK[day.day_of_week].name}`);
        return false;
      }

      if (day.start_time >= day.end_time) {
        setError(
          `❌ End time must be after start time (${DAYS_OF_WEEK[day.day_of_week].name})`,
        );
        return false;
      }
    }

    return true;
  };

  const handleSaveSchedule = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!validateSchedule()) return;

      setSaving(true);

      const activeDays = Object.values(schedule).filter((day) => day.is_active);

      for (const day of activeDays) {
        console.log("Sending to backend:", {
          doctor_id: doctorUUID,
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
          consultation_duration: Number(day.consultation_duration),
        });

        await scheduleAPI.setSchedule(doctorUUID, {
          doctor_id: doctorUUID, // IMPORTANT FIX
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
          consultation_duration: Number(day.consultation_duration),
        });
      }

      setSuccess(" Schedule saved successfully!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Full backend error:", err);

      const backendMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to save schedule";

      setError(`❌ ${backendMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="schedule-manager-container">
      <div className="schedule-card">
        <h2 className="schedule-title">📅 Manage Your Schedule</h2>
        <p className="schedule-subtitle">
          Set your weekly availability and consultation timing. Make sure to hit
          “Save Schedule” when you are done.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? (
          <p className="loading">Loading schedule...</p>
        ) : (
          <>
            <div className="schedule-items">
              {DAYS_OF_WEEK.map((day) => {
                const daySchedule = schedule[day.id] || {};
                const isActive = daySchedule.is_active;

                return (
                  <div
                    key={day.id}
                    className={`schedule-item ${isActive ? "active" : "inactive"}`}
                  >
                    <div className="day-header">
                      <label className="day-checkbox">
                        <input
                          type="checkbox"
                          checked={!!isActive}
                          onChange={() => toggleDayActive(day.id)}
                        />
                        <span className="day-name">{day.name}</span>
                      </label>

                      {isActive && (
                        <button
                          type="button"
                          className="toggle-details"
                          onClick={() => toggleDayDetails(day.id)}
                        >
                          {expandedDayId === day.id ? "Hide details" : "Edit"}
                        </button>
                      )}
                    </div>

                    {isActive ? (
                      <>
                        <div className="day-summary">
                          <span>
                            {daySchedule.start_time} - {daySchedule.end_time}
                          </span>
                          <span>• {daySchedule.consultation_duration} min</span>
                        </div>

                        {expandedDayId === day.id && (
                          <div className="time-inputs">
                            <div className="input-group">
                              <label>Start time</label>
                              <input
                                type="time"
                                value={daySchedule.start_time}
                                onChange={(e) =>
                                  handleDayChange(day.id, "start_time", e.target.value)
                                }
                              />
                            </div>

                            <div className="input-group">
                              <label>End time</label>
                              <input
                                type="time"
                                value={daySchedule.end_time}
                                onChange={(e) =>
                                  handleDayChange(day.id, "end_time", e.target.value)
                                }
                              />
                            </div>

                            <div className="input-group">
                              <label>Duration</label>
                              <select
                                value={daySchedule.consultation_duration}
                                onChange={(e) =>
                                  handleDayChange(
                                    day.id,
                                    "consultation_duration",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="15">15 min</option>
                                <option value="20">20 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                    <div className="day-summary off">Not available</div>
                  )}
                </div>
              );
            })}
          </div>

            <button onClick={handleSaveSchedule} disabled={saving} className="save-button">
              {saving ? "Saving..." : "Save Schedule"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}