from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import numpy as np
import logging

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:8080"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ml_model.log'),
        logging.StreamHandler()
    ]
)

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
      'abnormal_menstruation', 'dischromic _patches', 'watering_from_eyes', 'increased_appetite', 'polyuria',
      'family_history', 'mucoid_sputum', 'rusty_sputum', 'lack_of_concentration', 'visual_disturbances',
      'receiving_blood_transfusion', 'receiving_unsterile_injections', 'coma', 'stomach_bleeding',
      'distention_of_abdomen', 'history_of_alcohol_consumption', 'fluid_overload', 'blood_in_sputum',
      'prominent_veins_on_calf', 'palpitations', 'painful_walking', 'pus_filled_pimples', 'blackheads', 'scurring',
      'skin_peeling', 'silver_like_dusting', 'small_dents_in_nails', 'inflammatory_nails', 'blister',
      'red_sore_around_nose', 'yellow_crust_ooze']

disease = ['Fungal infection', 'Allergy', 'GERD', 'Chronic cholestasis', 'Drug Reaction',
           'Peptic ulcer diseae', 'AIDS', 'Diabetes', 'Gastroenteritis', 'Bronchial Asthma', 'Hypertension',
           'Migraine', 'Cervical spondylosis',
           'Paralysis (brain hemorrhage)', 'Jaundice', 'Malaria', 'Chicken pox', 'Dengue', 'Typhoid', 'hepatitis A',
           'Hepatitis B', 'Hepatitis C', 'Hepatitis D', 'Hepatitis E', 'Alcoholic hepatitis', 'Tuberculosis',
           'Common Cold', 'Pneumonia', 'Dimorphic hemmorhoids(piles)',
           'Heartattack', 'Varicoseveins', 'Hypothyroidism', 'Hyperthyroidism', 'Hypoglycemia', 'Osteoarthristis',
           'Arthritis', '(vertigo) Paroymsal  Positional Vertigo', 'Acne', 'Urinary tract infection', 'Psoriasis',
           'Impetigo']

# Load and validate training data
try:
    df = pd.read_csv("./ml_models/Training.csv")
    logging.info("Successfully loaded Training.csv")
    
    # Validate symptoms against dataset columns
    valid_columns = [symptom for symptom in l1 if symptom in df.columns]
    missing = [symptom for symptom in l1 if symptom not in df.columns]

    if missing:
        logging.warning(f"⚠️ Warning: {len(missing)} symptoms missing from Training.csv:")
        logging.warning(f"Missing symptoms: {missing}")
        
        # Save missing symptoms to a separate log file
        with open('missing_symptoms.log', 'w') as f:
            f.write(f"Missing symptoms ({len(missing)}):\n")
            f.write('\n'.join(missing))

    # Use only valid columns for training
    X = df[valid_columns]
    y = df[["prognosis"]]
    
    # Train model with valid columns
    clf = DecisionTreeClassifier()
    clf = clf.fit(X, y)
    logging.info(f"Model trained successfully with {len(valid_columns)} symptoms")
    
except Exception as e:
    logging.error(f"Error setting up ML model: {str(e)}")
    raise

@app.route('/predict-disease', methods=['POST'])
def predict_disease():
    try:
        data = request.get_json()
        logging.debug(f"Received data: {data}")
        
        if not data or 'symptoms' not in data:
            return jsonify({'error': 'No symptoms provided'}), 400
        
        symptoms = data['symptoms']
        logging.debug(f"Processing symptoms: {symptoms}")
        
        # Create input vector using only valid columns
        input_vector = np.zeros(len(valid_columns))
        for i, symptom in enumerate(valid_columns):
            if symptom in symptoms and symptoms[symptom] == 1:
                input_vector[i] = 1
        
        input_vector = input_vector.reshape(1, -1)
        prediction = clf.predict(input_vector)
        confidence = np.max(clf.predict_proba(input_vector))
        
        # Use the predicted disease name directly
        predicted_disease = str(prediction[0])
        logging.info(f"Predicted disease: {predicted_disease}, Confidence: {confidence:.4f}")

        # Use disease name for related symptoms logic
        try:
            # Ensure we're comparing strings (avoid ambiguous Series truth-value)
            y_values = y['prognosis'].values.ravel().astype(str)
            mask = (y_values == predicted_disease)

            if mask.sum() == 0:
                logging.warning(f"No training rows found for predicted disease '{predicted_disease}' - related_symptoms will be empty")
                related_symptoms = []
            else:
                related_symptoms = []
                for col in valid_columns:
                    # get column values as numpy array and compute mean only over matching rows
                    col_vals = X[col].values
                    mean_val = float(np.mean(col_vals[mask]))
                    logging.debug(f"Mean presence of '{col}' for disease '{predicted_disease}': {mean_val:.4f}")
                    if mean_val > 0.3:
                        related_symptoms.append(col)
        except Exception as ex:
            logging.error(f"Error computing related_symptoms: {ex}")
            related_symptoms = []
        
        response = {
            "predicted_disease": predicted_disease,
            "confidence": float(confidence),
            "related_symptoms": related_symptoms
        }
        logging.debug(f"Sending response: {response}")
        
        return jsonify(response)
        
    except Exception as e:
        logging.error(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
