from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib # To save/load the trained model
import os
from flask_cors import CORS # Import CORS

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Define the path for the data files relative to the server.py script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_CSV_PATH = os.path.join(BASE_DIR, "Training.csv")
MODEL_PATH = os.path.join(BASE_DIR, "randomforest_model.pkl")

l1 = ['back_pain', 'constipation', 'abdominal_pain', 'diarrhoea', 'mild_fever', 'yellow_urine',
      'yellowing_of_eyes', 'acute_liver_failure', 'fluid_overload', 'swelling_of_stomach',
      'swelled_lymph_nodes', 'malaise', 'blurred_and_distorted_vision', 'phlegm', 'throat_irritation',
      'redness_of_eyes', 'sinus_pressure', 'runny_nose', 'congestion', 'chest_pain', 'weakness_in_limbs',
      'fast_heart_rate', 'pain_during_bowel_movements', 'pain_in_anal_region', 'bloody_stool',
      'irritation_in_anus', 'neck_pain', 'dizziness', 'cramps', 'bruising', 'obesity', 'swollen_legs',
      'swollen_blood_vessels', 'puffy_face_and_eyes', 'enlarged_thyroid', 'brittle_nails',
      'swollen_extremeties', 'excessive_hunger', 'extra_marital_contacts', 'drying_and_tingling_lips',
      'slurred_speech', 'knee_pain', 'hip_joint_pain', 'muscle_weakness', 'stiff_neck', 'swelling_joints',
      'movement_stiffness', 'spinning_movements', 'loss_of_balance', 'unsteadiness',
      'weakness_of_one_body_side', 'loss_of_smell', 'bladder_discomfort', 'foul_smell_of_urine',
      'continuous_feel_of_urine', 'passage_of_gases', 'internal_itching', 'toxic_look_(typhos)',
      'depression', 'irritability', 'muscle_pain', 'altered_sensorium', 'red_spots_over_body', 'belly_pain',
      'abnormal_menstruation', 'dischromic _patches', 'watering_from_eyes', 'increased_appetite', 'polyuria', 'family_history', 'mucoid_sputum',
      'rusty_sputum', 'lack_of_concentration', 'visual_disturbances', 'receiving_blood_transfusion',
      'receiving_unsterile_injections', 'coma', 'stomach_bleeding', 'distention_of_abdomen',
      'history_of_alcohol_consumption', 'fluid_overload', 'blood_in_sputum', 'prominent_veins_on_calf',
      'palpitations', 'painful_walking', 'pus_filled_pimples', 'blackheads', 'scurring', 'skin_peeling',
      'silver_like_dusting', 'small_dents_in_nails', 'inflammatory_nails', 'blister', 'red_sore_around_nose',
      'yellow_crust_ooze']

disease = ['Fungal infection', 'Allergy', 'GERD', 'Chronic cholestasis', 'Drug Reaction',
           'Peptic ulcer diseae', 'AIDS', 'Diabetes', 'Gastroenteritis', 'Bronchial Asthma', 'Hypertension',
           ' Migraine', 'Cervical spondylosis',
           'Paralysis (brain hemorrhage)', 'Jaundice', 'Malaria', 'Chicken pox', 'Dengue', 'Typhoid', 'hepatitis A',
           'Hepatitis B', 'Hepatitis C', 'Hepatitis D', 'Hepatitis E', 'Alcoholic hepatitis', 'Tuberculosis',
           'Common Cold', 'Pneumonia', 'Dimorphic hemmorhoids(piles)',
           'Heartattack', 'Varicoseveins', 'Hypothyroidism', 'Hyperthyroidism', 'Hypoglycemia', 'Osteoarthristis',
           'Arthritis', '(vertigo) Paroymsal  Positional Vertigo', 'Acne', 'Urinary tract infection', 'Psoriasis',
           'Impetigo']

# Load and train model (or load a pre-trained one)
def train_model():
    df = pd.read_csv(TRAINING_CSV_PATH)
    # Replace prognosis string with numerical values (already done in clean_code.py, but good to ensure)
    disease_mapping = {d: i for i, d in enumerate(sorted(set(disease)))} # Create mapping dynamically
    df['prognosis'] = df['prognosis'].replace(disease_mapping)

    X = df[l1]
    y = df["prognosis"]

    clf4 = RandomForestClassifier()
    clf4 = clf4.fit(X, np.ravel(y))
    joblib.dump(clf4, MODEL_PATH) # Save the model
    return clf4

if os.path.exists(MODEL_PATH):
    clf4 = joblib.load(MODEL_PATH)
else:
    clf4 = train_model()

@app.route('/predict-disease', methods=['POST'])
def predict_disease():
    data = request.get_json()
    symptoms_input = data.get('symptoms', {})

    # Prepare input array for the model
    input_test = [0] * len(l1)
    present_symptoms_for_ml = []
    for symptom, present in symptoms_input.items():
        if symptom in l1 and present == 1:
            input_test[l1.index(symptom)] = 1
            present_symptoms_for_ml.append(symptom) # Collect symptoms present in ML input

    input_test_df = pd.DataFrame([input_test], columns=l1)

    predict_proba = clf4.predict_proba(input_test_df)
    predicted_index = np.argmax(predict_proba)
    predicted_disease = disease[predicted_index]
    confidence = float(predict_proba[0][predicted_index])

    # For related symptoms, we'll return the symptoms that were marked as present (1) in the input.
    # In a more advanced scenario, we'd analyze feature importance for the predicted disease.
    related_symptoms = present_symptoms_for_ml[:5] # Limit to 5 for clarity as per requirement

    return jsonify({'predicted_disease': predicted_disease, 'confidence': confidence, 'related_symptoms': related_symptoms})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) # Changed port to 5001
