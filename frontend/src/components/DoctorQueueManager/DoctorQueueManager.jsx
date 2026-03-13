import React, { useState, useEffect } from "react";
import axios from "axios";

export default function DoctorQueueManager({ doctorId }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    fetchQueue();
    // WebSocket for real-time queue updates
    const socket = window.io?.("/queue");
    if (socket) {
      socket.emit("doctor-join-queue", doctorId);
      socket.on("queue-update", (data) => {
        setQueue(data.queue);
      });
      socket.on("patient-arrived", (data) => {
        fetchQueue();
      });
      socket.on("queue-advanced", (data) => {
        fetchQueue();
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [doctorId]);

  const fetchQueue = async () => {
    try {
      const response = await axios.get(
        `/api/v2/queue/doctor/${doctorId}?date=${selectedDate}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setQueue(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch queue", error);
    } finally {
      setLoading(false);
    }
  };

  const markInProgress = async (appointmentId) => {
    try {
      await axios.post(
        `/api/v2/queue/${appointmentId}/in-progress`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      fetchQueue();
    } catch (error) {
      alert("Failed to mark patient in progress");
    }
  };

  const markCompleted = async (appointmentId) => {
    try {
      await axios.post(
        `/api/v2/queue/${appointmentId}/completed`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      fetchQueue();
    } catch (error) {
      alert("Failed to mark patient completed");
    }
  };

  const skipPatient = async (appointmentId) => {
    if (confirm("Are you sure you want to skip this patient?")) {
      try {
        await axios.post(
          `/api/v2/queue/${appointmentId}/skip`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        fetchQueue();
      } catch (error) {
        alert("Failed to skip patient");
      }
    }
  };

  if (loading) return <div>Loading queue...</div>;

  return (
    <div className="doctor-queue-manager">
      <h2>Queue Management</h2>

      <div className="queue-stats">
        <div className="stat">
          <span className="stat-value">{queue.length}</span>
          <span className="stat-label">Total Patients</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {queue.filter((q) => q.status === "waiting").length}
          </span>
          <span className="stat-label">Waiting</span>
        </div>
      </div>

      <div className="queue-table">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient Name</th>
              <th>Status</th>
              <th>Wait Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((patient) => (
              <tr key={patient.id} className={`status-${patient.status}`}>
                <td className="token">#{patient.token_number}</td>
                <td>{patient.patient_name}</td>
                <td>
                  <span className={`badge badge-${patient.status}`}>
                    {patient.status.toUpperCase()}
                  </span>
                </td>
                <td>{patient.estimated_wait_minutes} min</td>
                <td className="actions">
                  {patient.status === "waiting" && (
                    <>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => markInProgress(patient.appointment_id)}
                      >
                        Start
                      </button>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => skipPatient(patient.appointment_id)}
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {patient.status === "in_progress" && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => markCompleted(patient.appointment_id)}
                    >
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
