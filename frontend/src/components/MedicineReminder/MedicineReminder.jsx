import React, { useState, useEffect } from 'react';
import './MedicineReminder.css';

const MedicineReminder = () => {
  const [reminders, setReminders] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [dosage, setDosage] = useState('');
  const [time, setTime] = useState('08:00');
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    const savedReminders = localStorage.getItem('medicineReminders');
    if (savedReminders) {
      setReminders(JSON.parse(savedReminders));
    }
    
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('medicineReminders', JSON.stringify(reminders));
  }, [reminders]);

  // Check for reminders every minute
  useEffect(() => {
    const interval = setInterval(() => {
      checkReminders();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [reminders]);

  const toMinutesSinceMidnight = (time, period) => {
    const [hours, minutes] = time.split(':').map(Number);

    // Convert 12-hour input to 24-hour minutes
    const hour12 = hours % 12; // 12 -> 0, otherwise same
    const hour24 = period === 'PM' ? hour12 + 12 : hour12;

    return hour24 * 60 + minutes;
  };

  const checkReminders = () => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    reminders.forEach(reminder => {
      const reminderMinutes = toMinutesSinceMidnight(reminder.time, reminder.period);

      // Check if it's time for the reminder (within 1 minute)
      if (Math.abs(currentTime - reminderMinutes) <= 1) {
        // Check if not already taken today
        const today = new Date().toDateString();
        if (!reminder.completed.includes(today)) {
          showNotification(reminder);
        }
      }
    });
  };

  const showNotification = (reminder) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('💊 Medicine Reminder', {
        body: `Time to take ${reminder.medicine} - ${reminder.dosage}`,
        icon: '/favicon.ico',
        tag: `reminder-${reminder.id}`,
        requireInteraction: true
      });
    } else {
      // Fallback alert
      alert(`💊 Medicine Reminder!\n\nTime to take: ${reminder.medicine}\nDosage: ${reminder.dosage}\nTime: ${reminder.time} ${reminder.period}`);
    }
  };

  const handleAddReminder = () => {
    if (!selectedMedicine || !dosage) {
      alert('Please fill in all fields');
      return;
    }
    
    const newReminder = {
      id: Date.now(),
      medicine: selectedMedicine,
      dosage,
      time,
      period,
      completed: [],
      createdAt: new Date().toISOString()
    };
    setReminders([...reminders, newReminder]);
    setOpenDialog(false);
    setSelectedMedicine('');
    setDosage('');
    setTime('08:00');
    setPeriod('AM');
  };

  const markTaken = (reminderId) => {
    const today = new Date().toDateString();
    setReminders(prev => prev.map(reminder => {
      if (reminder.id === reminderId) {
        const completed = reminder.completed.includes(today) 
          ? reminder.completed.filter(date => date !== today)
          : [...reminder.completed, today];
        return { ...reminder, completed };
      }
      return reminder;
    }));
  };

  const deleteReminder = (reminderId) => {
    setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
  };

  const isTodayCompleted = (reminder) => {
    const today = new Date().toDateString();
    return reminder.completed.includes(today);
  };

  const getHourMinute = (time) => {
    const [hourStr, minuteStr] = time.split(':');
    return {
      hour: Number(hourStr),
      minute: Number(minuteStr),
    };
  };

  const pad2 = (value) => String(value).padStart(2, '0');

  const formatTime = (time, period) => {
    return `${time} ${period}`;
  };

  const testNotification = () => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('💊 Test Notification', {
          body: 'Medicine reminder notifications are working!',
          icon: '/favicon.ico'
        });
      } else {
        alert('Please allow notifications in your browser settings to receive medicine reminders.');
      }
    } else {
      alert('Notifications are not supported in this browser.');
    }
  };

  return (
    <div className="medicine-reminder">
      <div className="reminder-header">
        <h2>💊 Medicine Reminder</h2>
        <div className="header-actions">
          <button 
            className="test-notification-btn"
            onClick={testNotification}
          >
            🔔 Test Notifications
          </button>
          <button 
            className="add-button"
            onClick={() => setOpenDialog(true)}
          >
            ➕ Add Reminder
          </button>
        </div>
      </div>

      <div className="reminders-grid">
        {reminders.length === 0 ? (
          <div className="empty-reminders">
            <h3>No Medicine Reminders</h3>
            <p>Add your first medicine reminder to stay on track!</p>
            <p className="notification-info">
              💡 Enable notifications to receive reminders when it's time to take your medicine!
            </p>
          </div>
        ) : (
          reminders.map(reminder => (
            <div 
              key={reminder.id} 
              className={`reminder-card ${isTodayCompleted(reminder) ? 'completed' : ''}`}
            >
              <div className="reminder-header-card">
                <h3>{reminder.medicine}</h3>
                <span className="dosage">{reminder.dosage}</span>
              </div>
              
              <div className="reminder-details">
                <p><strong>Time:</strong> {formatTime(reminder.time, reminder.period)}</p>
                <p><strong>Taken:</strong> {reminder.completed.length} times</p>
                <p><strong>Status:</strong> {isTodayCompleted(reminder) ? '✅ Taken Today' : '⏰ Pending'}</p>
              </div>

              <div className="reminder-actions-card">
                <button
                  className={`mark-button ${isTodayCompleted(reminder) ? 'taken' : ''}`}
                  onClick={() => markTaken(reminder.id)}
                >
                  {isTodayCompleted(reminder) ? '✓ Taken Today' : 'Mark as Taken'}
                </button>
                <button
                  className="delete-button"
                  onClick={() => deleteReminder(reminder.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {openDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Add Medicine Reminder</h3>
            <div className="form-group">
              <label>Medicine Name:</label>
              <input
                type="text"
                value={selectedMedicine}
                onChange={(e) => setSelectedMedicine(e.target.value)}
                placeholder="Enter medicine name"
              />
            </div>
            <div className="form-group">
              <label>Dosage:</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 1 tablet, 10ml"
              />
            </div>
            <div className="time-group">
              <div className="form-group">
                <label>Hour:</label>
                <select
                  value={getHourMinute(time).hour}
                  onChange={(e) => {
                    const newHour = Number(e.target.value);
                    const { minute } = getHourMinute(time);
                    setTime(`${pad2(newHour)}:${pad2(minute)}`);
                  }}
                >
                  {[...Array(12)].map((_, i) => {
                    const hour = i + 1;
                    return (
                      <option key={hour} value={hour}>
                        {pad2(hour)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label>Minute:</label>
                <select
                  value={getHourMinute(time).minute}
                  onChange={(e) => {
                    const newMinute = Number(e.target.value);
                    const { hour } = getHourMinute(time);
                    setTime(`${pad2(hour)}:${pad2(newMinute)}`);
                  }}
                >
                  {Array.from({ length: 60 }, (_, i) => pad2(i)).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Period:</label>
                <select 
                  value={period} 
                  onChange={(e) => setPeriod(e.target.value)}
                  className="period-select"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div className="notification-note">
              <p>🔔 You'll receive a notification at {formatTime(time, period)} daily</p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setOpenDialog(false)}>Cancel</button>
              <button onClick={handleAddReminder} className="add-btn">Add Reminder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineReminder;