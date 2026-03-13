import React, { useState, useEffect } from "react";
import { timelineAPI } from "../../api/techmedixAPI";
import "./MedicalTimeline.css";

/**
 * MEDICAL TIMELINE COMPONENT
 * Displays comprehensive patient medical history
 * Vertical timeline layout with filtering and expandable cards
 */
export default function MedicalTimeline({ patientId }) {
  const [timeline, setTimeline] = useState([]);
  const [filteredTimeline, setFilteredTimeline] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const CATEGORIES = [
    { id: "all", label: "All Events" },
    { id: "appointment", label: "Appointments" },
    { id: "prescription", label: "Prescriptions" },
    { id: "visit", label: "Visits" },
    { id: "disease", label: "Diseases" },
    { id: "report", label: "Reports" },
  ];

  // Fetch timeline data
  useEffect(() => {
    const fetchTimeline = async () => {
      if (!patientId) return;
      try {
        setLoading(true);
        console.log("Fetching timeline for patient:", patientId);

        const response = await timelineAPI.getTimeline(patientId, "all", 100);

        console.log("Timeline API response:", response.data);

        const timelineData = response.data.timeline || [];

        if (!Array.isArray(timelineData)) {
          console.warn("Unexpected timeline format:", timelineData);
        }

        setTimeline(Array.isArray(timelineData) ? timelineData : []);
        setFilteredTimeline(Array.isArray(timelineData) ? timelineData : []);
      } catch (err) {
        setError("Failed to load medical timeline: " + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [patientId]);

  // Filter timeline by category
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);

    if (categoryId === "all") {
      setFilteredTimeline(timeline);
    } else {
      const filtered = timeline.filter((item) => item.type === categoryId);
      setFilteredTimeline(filtered);
    }
  };

  // Toggle item expansion
  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get icon for event type
  const getEventIcon = (type) => {
    const icons = {
      appointment: "📅",
      prescription: "💊",
      visit: "🏥",
      disease: "🔴",
      report: "📄",
    };
    return icons[type] || "📌";
  };

  // Get badge color for status
  const getStatusColor = (status) => {
    const colors = {
      completed: "#10b981",
      booked: "#3b82f6",
      active: "#f59e0b",
      inactive: "#6b7280",
      pending: "#8b5cf6",
    };
    return colors[status] || "#6b7280";
  };

  return (
    <div className="medical-timeline-container">
      <h1>Medical Timeline</h1>

      {error && <div className="error-message">{error}</div>}

      {/* Category Filter */}
      <div className="timeline-filters">
        <div className="filter-buttons">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`filter-btn ${selectedCategory === category.id ? "active" : ""}`}
              onClick={() => handleCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="event-count">{filteredTimeline.length} events</div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="loading">Loading timeline...</div>
      ) : filteredTimeline.length === 0 ? (
        <div className="no-events">No events found in this category</div>
      ) : (
        <div className="timeline">
          {filteredTimeline.map((item, index) => (
            <div key={item.id || index} className="timeline-item">
              {/* Timeline Marker */}
              <div className="timeline-marker">
                <div className="marker-icon">{getEventIcon(item.type)}</div>
                <div className="timeline-line" />
              </div>

              {/* Event Card */}
              <div className="event-card">
                {/* Header */}
                <div
                  className="event-header"
                  onClick={() => toggleExpanded(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="event-title-row">
                    <h3>{item.title}</h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(item.status) }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="event-date">{formatDate(item.date)}</p>
                </div>

                {/* Expanded Details */}
                {expandedItems.has(item.id) && (
                  <div className="event-details">
                    {/* Appointment Details */}
                    {item.type === "appointment" && (
                      <div>
                        <p>
                          <strong>Doctor:</strong> {item.details.doctor_name}
                        </p>
                        <p>
                          <strong>Time:</strong> {item.details.appointment_time}
                        </p>
                        <p>
                          <strong>Payment Status:</strong> {item.payment_status}
                        </p>
                        <button className="action-btn">View Appointment</button>
                      </div>
                    )}

                    {/* Prescription Details */}
                    {item.type === "prescription" && (
                      <div>
                        <p>
                          <strong>Medicine:</strong>{" "}
                          {item.details.medicine_name}
                        </p>
                        <p>
                          <strong>Dosage:</strong> {item.details.dosage}
                        </p>
                        <p>
                          <strong>Frequency:</strong> {item.details.frequency}
                        </p>
                        <p>
                          <strong>Duration:</strong>{" "}
                          {item.details.duration_days} days
                        </p>
                        <p>
                          <strong>Doctor:</strong> {item.details.doctor_name}
                        </p>
                        {item.status === "expired" && (
                          <button className="action-btn">Request Refill</button>
                        )}
                      </div>
                    )}

                    {/* Visit Details */}
                    {item.type === "visit" && (
                      <div>
                        <p>
                          <strong>Type:</strong> {item.details.visit_type}
                        </p>
                        {item.details.chief_complaint && (
                          <p>
                            <strong>Chief Complaint:</strong>{" "}
                            {item.details.chief_complaint}
                          </p>
                        )}
                        {item.details.diagnosis && (
                          <p>
                            <strong>Diagnosis:</strong> {item.details.diagnosis}
                          </p>
                        )}
                        <p>
                          <strong>Doctor:</strong> {item.details.doctor_name}
                        </p>
                      </div>
                    )}

                    {/* Disease Details */}
                    {item.type === "disease" && (
                      <div>
                        <p>
                          <strong>Disease:</strong> {item.details.disease_name}
                        </p>
                        <p>
                          <strong>Severity:</strong> {item.details.severity}
                        </p>
                        <p>
                          <strong>Diagnosed:</strong>{" "}
                          {formatDate(item.details.diagnosed_on)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .medical-timeline-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        h1 {
          color: #1f2937;
          margin-bottom: 20px;
        }

        .timeline-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .filter-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: white;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 14px;
        }

        .filter-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .filter-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .event-count {
          color: #6b7280;
          font-size: 14px;
        }

        .timeline {
          position: relative;
        }

        .timeline-item {
          display: flex;
          margin-bottom: 30px;
          position: relative;
        }

        .timeline-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-right: 20px;
          flex-shrink: 0;
        }

        .marker-icon {
          width: 48px;
          height: 48px;
          background: #f3f4f6;
          border: 2px solid #e5e7eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          position: relative;
          z-index: 2;
        }

        .timeline-line {
          width: 2px;
          flex-grow: 1;
          background: #e5e7eb;
          margin-top: 8px;
        }

        .timeline-item:last-child .timeline-line {
          display: none;
        }

        .event-card {
          flex-grow: 1;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
        }

        .event-card:hover {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-color: #3b82f6;
        }

        .event-header {
          cursor: pointer;
        }

        .event-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .event-title-row h3 {
          margin: 0;
          color: #1f2937;
          font-size: 16px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          font-weight: 500;
        }

        .event-date {
          color: #6b7280;
          font-size: 12px;
          margin: 0;
        }

        .event-details {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .event-details p {
          margin: 8px 0;
          color: #374151;
          font-size: 14px;
        }

        .event-details strong {
          color: #1f2937;
        }

        .action-btn {
          margin-top: 12px;
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.3s;
        }

        .action-btn:hover {
          background: #2563eb;
        }

        .loading,
        .no-events {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .error-message {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
}
