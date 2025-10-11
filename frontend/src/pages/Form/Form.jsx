import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import symptomsList from "../../utils/symptomsList";
import "./Form.css";

const API_URL = import.meta.env.VITE_API_URL;

// Categorized symptoms
const categorizedSymptoms = {
  "Skin & Dermatological": [
    "itching", "skin_rash", "nodal_skin_eruptions", "patches_in_throat",
    "red_spots_over_body", "blackheads", "scurring", "skin_peeling",
    "silver_like_dusting", "small_dents_in_nails", "inflammatory_nails",
    "blister", "red_sore_around_nose", "yellow_crust_ooze"
  ],
  "Respiratory": [
    "continuous_sneezing", "cough", "breathlessness", "phlegm",
    "throat_irritation", "sinus_pressure", "runny_nose", "congestion"
  ],
  "Fever / Infection / Systemic": [
    "shivering", "chills", "high_fever", "malaise",
    "toxic_look_(typhos)", "dehydration"
  ],
  "Gastrointestinal / Digestive": [
    "stomach_pain", "acidity", "ulcers_on_tongue", "vomiting",
    "indigestion", "abdominal_pain", "diarrhoea", "constipation",
    "belly_pain", "stomach_bleeding", "distention_of_abdomen"
  ],
  "Musculoskeletal / Joint / Pain": [
    "joint_pain", "muscle_wasting", "muscle_pain", "back_pain",
    "cramps", "bruising", "knee_pain", "hip_joint_pain",
    "muscle_weakness", "stiff_neck", "swelling_joints",
    "movement_stiffness", "painful_walking"
  ],
  "Urinary / Renal": [
    "burning_micturition", "spotting_urination", "foul_smell_of_urine",
    "continuous_feel_of_urine", "passage_of_gases", "polyuria",
    "bladder_discomfort", "blood_in_sputum"
  ],
  "Cardiovascular / Circulatory": [
    "fast_heart_rate", "palpitations", "weakness_in_limbs",
    "swollen_legs", "swollen_blood_vessels", "puffy_face_and_eyes",
    "prominent_veins_on_calf"
  ],
  "Metabolic / Endocrine": [
    "weight_gain", "weight_loss", "obesity", "irregular_sugar_level",
    "excessive_hunger", "increased_appetite"
  ],
  "Neurological / Mental Health": [
    "anxiety", "mood_swings", "restlessness", "lethargy",
    "depression", "irritability", "lack_of_concentration",
    "altered_sensorium", "loss_of_balance", "unsteadiness",
    "weakness_of_one_body_side", "loss_of_smell", "slurred_speech",
    "spinning_movements", "visual_disturbances"
  ],
  "Eye / Vision": [
    "sunken_eyes", "redness_of_eyes", "watering_from_eyes",
    "blurred_and_distorted_vision"
  ],
  "Liver / Kidney / Other Organ Dysfunction": [
    "yellowish_skin", "dark_urine", "yellow_urine", "yellowing_of_eyes",
    "acute_liver_failure"
  ],
  "Reproductive / Hormonal": [
    "abnormal_menstruation", "extra_marital_contacts", "family_history"
  ],
  "Misc / Other": [
    "mucoid_sputum", "rusty_sputum", "coma",
    "receiving_blood_transfusion", "receiving_unsterile_injections",
    "history_of_alcohol_consumption", "prognosis"
  ]
};

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
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user || !user.id || !user.email) {
        alert("User not logged in or user ID/email not found.");
        return;
      }

      const dataToSend = {
        patientId: user.id,
        email: user.email,
        symptoms: selectedSymptoms,
        ehr: {
          bloodPressure: {
            systolic: formData.systolic,
            diastolic: formData.diastolic,
          },
          heartRate: formData.heartRate,
          glucose: formData.glucose,
          cholesterol: formData.cholesterol,
          temperature: formData.temperature,
          spo2: formData.spo2,
          bmi: formData.bmi,
          weight: formData.weight,
          sleep: formData.sleep,
          steps: formData.steps,
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

      const response = await axios.post(`${API_URL}/api/patientdata`, dataToSend, {
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
      alert("Error submitting health data.");
    }
  };

  // Group fields into pairs for 2-column layout
  const fieldGroups = [
    [
      { label: "Systolic (mmHg)", name: "systolic" },
      { label: "Diastolic (mmHg)", name: "diastolic" }
    ],
    [
      { label: "Heart Rate (bpm)", name: "heartRate" },
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
<<<<<<< HEAD

=======
                  
>>>>>>> e059d9d (final commit)
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
