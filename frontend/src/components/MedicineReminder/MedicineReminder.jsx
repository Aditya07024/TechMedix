import React, { useState, useEffect } from 'react';
import './MedicineReminder.css';

const MedicineReminder = () => {
  const [reminders, setReminders] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [dosage, setDosage] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderType, setReminderType] = useState('medicine');
  const [activeTab, setActiveTab] = useState('all');
  const [time, setTime] = useState('08:00');
  const [period, setPeriod] = useState('AM');
  const [hasLoadedReminders, setHasLoadedReminders] = useState(false);

  useEffect(() => {
    const savedReminders = localStorage.getItem('medicineReminders');
    if (savedReminders) {
      const parsedReminders = JSON.parse(savedReminders).map((reminder) => ({
        lastTriggeredOn: null,
        ...reminder,
        completed: Array.isArray(reminder.completed) ? reminder.completed : [],
      }));
      setReminders(parsedReminders);
    }
    setHasLoadedReminders(true);
    
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedReminders) return;
    localStorage.setItem('medicineReminders', JSON.stringify(reminders));
  }, [reminders, hasLoadedReminders]);

  useEffect(() => {
    const timeouts = reminders.map((reminder) => scheduleReminder(reminder));

    return () => {
      timeouts.forEach((timeoutId) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    };
  }, [reminders]);

  const toMinutesSinceMidnight = (time, period) => {
    const [hours, minutes] = time.split(':').map(Number);

    // Convert 12-hour input to 24-hour minutes
    const hour12 = hours % 12; // 12 -> 0, otherwise same
    const hour24 = period === 'PM' ? hour12 + 12 : hour12;

    return hour24 * 60 + minutes;
  };

  const getNextReminderDate = (reminder) => {
    const now = new Date();
    const reminderMinutes = toMinutesSinceMidnight(reminder.time, reminder.period);
    const nextReminder = new Date(now);

    nextReminder.setHours(Math.floor(reminderMinutes / 60), reminderMinutes % 60, 0, 0);

    const today = now.toDateString();
    const alreadyHandledToday =
      reminder.completed.includes(today) || reminder.lastTriggeredOn === today;

    if (nextReminder <= now || alreadyHandledToday) {
      nextReminder.setDate(nextReminder.getDate() + 1);
    }

    return nextReminder;
  };

  const triggerReminder = (reminderId) => {
    setReminders((prev) =>
      prev.map((reminder) => {
        if (reminder.id !== reminderId) {
          return reminder;
        }

        const today = new Date().toDateString();
        if (reminder.completed.includes(today) || reminder.lastTriggeredOn === today) {
          return reminder;
        }

        showNotification(reminder);
        return { ...reminder, lastTriggeredOn: today };
      }),
    );
  };

  const scheduleReminder = (reminder) => {
    const nextReminder = getNextReminderDate(reminder);
    const delay = Math.max(nextReminder.getTime() - Date.now(), 0);

    return window.setTimeout(() => {
      triggerReminder(reminder.id);
    }, delay);
  };

  const showNotification = (reminder) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('💊 Medicine Reminder', {
        body: `${reminder.message || 'Time to take your medicine'}\n${reminder.medicine} - ${reminder.dosage}`,
        icon: '/favicon.ico',
        tag: `reminder-${reminder.id}`,
        requireInteraction: true
      });
    } else {
      // Fallback alert
      alert(`💊 Medicine Reminder!\n\n${reminder.message || 'Time to take your medicine'}\n\nMedicine: ${reminder.medicine}\nDosage: ${reminder.dosage}\nTime: ${reminder.time} ${reminder.period}`);
    }
  };

  const handleAddReminder = () => {
    if (reminderType === 'medicine' && (!selectedMedicine || !dosage)) {
      alert('Please fill in all fields');
      return;
    }

    if (reminderType === 'message' && !reminderMessage) {
      alert('Please enter a reminder message');
      return;
    }
    
    const newReminder = {
      id: Date.now(),
      type: reminderType,
      medicine: reminderType === 'medicine' ? selectedMedicine : 'General Reminder',
      dosage: reminderType === 'medicine' ? dosage : '-',
      message: reminderMessage,
      time,
      period,
      completed: [],
      lastTriggeredOn: null,
      createdAt: new Date().toISOString()
    };
    setReminders((prev) => [...prev, newReminder]);
    setOpenDialog(false);
    setSelectedMedicine('');
    setDosage('');
    setReminderMessage('');
    setReminderType('medicine');
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
        return {
          ...reminder,
          completed,
          lastTriggeredOn: reminder.completed.includes(today) ? null : today,
        };
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

  const filteredReminders = reminders.filter((reminder) => {
    if (activeTab === 'all') return true;
    return reminder.type === activeTab;
  });

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
        <h2>🔔 Health Reminders</h2>
        <div className="header-actions">
          <button 
            className="test-notification-btn"
            onClick={testNotification}
          >
            🔔 Test Notifications
          </button>
          <button
            className="add-button"
            onClick={() => {
              setReminderType('medicine');
              setOpenDialog(true);
            }}
          >
            💊 Add Medicine Reminder
          </button>

          <button
            className="add-button"
            onClick={() => {
              setReminderType('message');
              setOpenDialog(true);
            }}
          >
            📝 Add Message Reminder
          </button>
        </div>
      </div>
      <div className="reminder-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={activeTab === 'all' ? 'add-button' : 'test-notification-btn'}
          onClick={() => setActiveTab('all')}
        >
          📋 All Reminders
        </button>

        <button
          className={activeTab === 'medicine' ? 'add-button' : 'test-notification-btn'}
          onClick={() => setActiveTab('medicine')}
        >
          💊 Medicine Reminders
        </button>

        <button
          className={activeTab === 'message' ? 'add-button' : 'test-notification-btn'}
          onClick={() => setActiveTab('message')}
        >
          📝 Message Reminders
        </button>
      </div>

      <div className="reminders-grid">
        {filteredReminders.length === 0 ? (
          <div className="empty-reminders">
            <h3>No Medicine Reminders</h3>
            <p>Add your first medicine reminder to stay on track!</p>
            <p className="notification-info">
              💡 Enable notifications to receive reminders when it's time to take your medicine!
            </p>
          </div>
        ) : (
          filteredReminders.map(reminder => (
            <div 
              key={reminder.id} 
              className={`reminder-card ${isTodayCompleted(reminder) ? 'completed' : ''}`}
            >
              <div className="reminder-header-card">
                <h3>{reminder.type === 'message' ? '📝 Message Reminder' : reminder.medicine}</h3>
                {reminder.type !== 'message' && (
                  <span className="dosage">{reminder.dosage}</span>
                )}
              </div>
              
              <div className="reminder-details">
                <p><strong>Time:</strong> {formatTime(reminder.time, reminder.period)}</p>
                {reminder.type === 'message' && (
                  <p><strong>Type:</strong> General Message Reminder</p>
                )}
                {reminder.message && (
                  <p><strong>Message:</strong> {reminder.message}</p>
                )}
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
            <h3>
              {reminderType === 'medicine'
                ? '💊 Add Medicine Reminder'
                : '📝 Add Message Reminder'}
            </h3>
            {reminderType === 'medicine' && (
            <>
            <div className="form2-group">
              <label>Medicine Name:</label>
              <input
                type="text"
                value={selectedMedicine || ''}
                onChange={(e) => setSelectedMedicine(e.target.value)}
                placeholder="Enter medicine name"
                autoComplete="off"
              />
            </div>
            <div className="form2-group">
              <label>Dosage:</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 1 tablet, 10ml"
              />
            </div>
            </>
            )}
            <div className="form2-group">
              <label>Reminder Message (Optional):</label>
              <input
                type="text"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="e.g., Take after breakfast, prescribed by Dr. Sharma"
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
