import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import symptomsList from "../../utils/symptomsList";
import "./Form.css";
import { API_BASE_URL } from "../../utils/apiBase";

export const Form = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    systolic: "",
    diastolic: "",
    heartRate: "",
    glucose: "",
    cholesterol: "",
    temperature: "",
    weight: "",
    bmi: "",
    spo2: "",
    sleep: "",
    steps: "",
    hemoglobin: "",
    rbc: "",
    wbc: "",
    platelets: "",
    mood: "",
    stress: "",
    creatinine: "",
    bilirubin: "",
    alt: "",
    ast: "",
    calories: "",
    diet: "",
    medication: "",
    allergies: "",
    bloodType: "",
    physicalActivityLevel: "",
    sleepQuality: "",
  });

  const [selectedSymptoms, setSelectedSymptoms] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [categorizedSymptoms, setCategorizedSymptoms] = useState({});

  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/diseases`);
        /* Expected backend format example:
           {
             "Respiratory": ["cough","breathlessness"],
             "Skin": ["itching","rash"]
           }
           Or flat array: [{ category: "...", symptom: "..." }, ...]
        */
        // Support both grouped format and flat DB rows
        if (Array.isArray(res.data)) {
          const grouped = {};
          res.data.forEach((row) => {
            const category = row.category || "Other";
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(row.symptom);
          });
          setCategorizedSymptoms(grouped);
        } else {
          setCategorizedSymptoms(res.data || {});
        }
      } catch (err) {
        console.error("Failed to load symptoms from backend:", err?.response?.data || err.message);
      }
    };

    fetchSymptoms();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSymptomChange = (symptom) => {
    setSelectedSymptoms((prev) => ({
      ...prev,
      [symptom]: prev[symptom] === 1 ? 0 : 1,
    }));
  };

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => {
      const isCurrentlyOpen = !!prev[category];
      // If clicking an already open category, collapse it.
      // Otherwise, open only this category and collapse all others.
      return isCurrentlyOpen ? {} : { [category]: true };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user.id || !user.email) {
        alert("User not logged in or user ID/email not found.");
        return;
      }

      const toIntOrNull = (value) => {
        if (value === "" || value == null) return null;
        const num = Number(value);
        return Number.isFinite(num) ? Math.round(num) : null;
      };

      const toFloatOrNull = (value) => {
        if (value === "" || value == null) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const dataToSend = {
        patientId: user.id,
        email: user.email,
        symptoms: selectedSymptoms,
        ehr: {
          bloodPressure: {
            systolic: toIntOrNull(formData.systolic),
            diastolic: toIntOrNull(formData.diastolic),
          },
          // heartRate: formData.heartRate,
          glucose: toIntOrNull(formData.glucose),
          cholesterol: toIntOrNull(formData.cholesterol),
          temperature: toFloatOrNull(formData.temperature),
          spo2: toIntOrNull(formData.spo2),
          bmi: toFloatOrNull(formData.bmi),
          weight: toFloatOrNull(formData.weight),
          sleep: toIntOrNull(formData.sleep),
          steps: toIntOrNull(formData.steps),
        },
        medicines: [],
        prescription: [],
        hemoglobin: formData.hemoglobin,
        rbc: formData.rbc,
        wbc: formData.wbc,
        platelets: formData.platelets,
        mood: formData.mood,
        stress: formData.stress,
        creatinine: formData.creatinine,
        bilirubin: formData.bilirubin,
        alt: formData.alt,
        ast: formData.ast,
        calories: formData.calories,
        diet: formData.diet,
        medication: formData.medication,
        allergies: formData.allergies,
        bloodType: formData.bloodType,
        physicalActivityLevel: formData.physicalActivityLevel,
        sleepQuality: formData.sleepQuality,
      };

      const response = await axios.post(`${API_BASE_URL}/api/patientdata`, dataToSend, {
        withCredentials: true,
      });

      if (response.status === 201) {
        alert("Health data submitted successfully!");
        navigate("/dashboard");
      } else {
        alert("Failed to submit health data.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);

      const backendMessage = error?.response?.data?.error || error?.response?.data || error.message;

      console.error("Backend response:", error?.response?.data);

      alert(`Submission failed: ${backendMessage}`);
    }
  };

  const handleFillDemoData = () => {
    setFormData({
      systolic: "118",
      diastolic: "76",
      heartRate: "72",
      glucose: "94",
      cholesterol: "178",
      temperature: "36.8",
      weight: "68",
      bmi: "22.4",
      spo2: "98",
      sleep: "7",
      steps: "8420",
      hemoglobin: "14.1",
      rbc: "4.8",
      wbc: "6900",
      platelets: "255000",
      mood: "Calm",
      stress: "3",
      creatinine: "0.9",
      bilirubin: "0.8",
      alt: "24",
      ast: "22",
      calories: "2140",
      diet: "Mixed balanced diet with mostly home-cooked meals",
      medication: "Vitamin D3 once weekly, Cetirizine as needed",
      allergies: "Dust allergy, no known drug allergy",
      bloodType: "B+",
      physicalActivityLevel: "Moderate",
      sleepQuality: "8",
    });

    setSelectedSymptoms({
      runny_nose: 1,
      redness_of_eyes: 1,
    });

    setExpandedCategories({
      Respiratory: true,
      Eye: true,
    });
  };

  // Group fields into pairs for 2-column layout
  const fieldGroups = [
    [
      { label: "Systolic (mmHg)", name: "systolic" },
      { label: "Diastolic (mmHg)", name: "diastolic" }
    ],
    [
      // { label: "Heart Rate (bpm)", name: "heartRate" },
      { label: "Blood Glucose (mg/dL)", name: "glucose" }
    ],
    [
      { label: "Cholesterol (mg/dL)", name: "cholesterol" },
      { label: "Body Temperature (°C)", name: "temperature" }
    ],
    [
      { label: "Weight (kg)", name: "weight" },
      { label: "BMI", name: "bmi" }
    ],
    [
      { label: "Oxygen Saturation (SpO₂ %)", name: "spo2" },
      { label: "Sleep Duration (hrs)", name: "sleep" }
    ],
    [
      { label: "Steps / Day", name: "steps" },
      { label: "Hemoglobin (g/dL)", name: "hemoglobin" }
    ],
    [
      { label: "RBC Count", name: "rbc" },
      { label: "WBC Count", name: "wbc" }
    ],
    [
      { label: "Platelets Count", name: "platelets" },
      { label: "Mood", name: "mood" }
    ],
    [
      { label: "Stress Level (1-10)", name: "stress" },
      { label: "Creatinine (mg/dL)", name: "creatinine" }
    ],
    [
      { label: "Bilirubin (mg/dL)", name: "bilirubin" },
      { label: "ALT (U/L)", name: "alt" }
    ],
    [
      { label: "AST (U/L)", name: "ast" },
      { label: "Daily Calories", name: "calories" }
    ],
    [
      { label: "Diet Pattern", name: "diet" },
      { label: "Current Medicines", name: "medication" }
    ],
    [
      { label: "Allergies", name: "allergies" },
      { label: "Blood Type", name: "bloodType" }
    ],
    [
      { label: "Physical Activity Level", name: "physicalActivityLevel" },
      { label: "Sleep Quality (1-10)", name: "sleepQuality" }
    ]
  ];

  return (
    <div className="login-form-container flex justify-center items-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="login-form p-8 bg-white rounded-2xl shadow-lg w-full max-w-6xl space-y-6"
      >
        <div className="form-heading text-2xl font-bold text-center mb-6">
          🩺 Health Form
        </div>

        <div className="form-actions-bar">
          <button
            type="button"
            className="demo-fill-btn"
            onClick={handleFillDemoData}
          >
            Fill Demo Data
          </button>
        </div>

        {/* Render input fields in rows of 2 */}
        {fieldGroups.map((row, rowIndex) => (
          <div className="input-row" key={rowIndex}>
            {row.map((field) => (
              <div className="input-group" key={field.name}>
                <label className="label" htmlFor={field.name}>
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  placeholder={field.label}
                  type="text"

                  value={formData[field.name]}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            ))}
          </div>
        ))}

        {/* Categorized Symptoms Section */}
        <div className="symptoms-section">
          <h3 className="symptoms-heading">😷 Select Your Symptoms</h3>
          <div className="categories-grid">
            {Object.entries(categorizedSymptoms).map(([category, symptoms]) => (
              <div key={category} className="symptom-category">
                <div 
                  className="category-header"
                  onClick={() => toggleCategory(category)}
                >
                  <span className="category-title">{category}</span>
                  <span className="category-arrow">
                    {expandedCategories[category] ? '▼' : '►'}
                  </span>
                </div>
                {expandedCategories[category] && (
                  <div className="symptoms-list">
                    {symptoms.map((symptom) => (
                      <label key={symptom} className="symptom-item">
                        <input
                          type="checkbox"
                          checked={selectedSymptoms[symptom] === 1}
                          onChange={() => handleSymptomChange(symptom)}
                          className="symptom-checkbox"
                        />
                        <span className="symptom-text">
                          {symptom.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="submit w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          Submit Health Data
        </button>
      </form>
    </div>
  );
};
