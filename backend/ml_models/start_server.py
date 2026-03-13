from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# Load the model
try:
    model = joblib.load('ml_models/disease_prediction_model.joblib')
except:
    print("Error loading model")

@app.route('/predict-disease', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        if not data or "symptoms" not in data:
            return jsonify({
                "success": False,
                "error": "Symptoms not provided"
            }), 400

        symptoms = data.get('symptoms', {})

        if not isinstance(symptoms, dict):
            return jsonify({
                "success": False,
                "error": "Symptoms must be an object"
            }), 400

        # Ensure consistent ordering of features
        feature_values = list(symptoms.values())

        if len(feature_values) == 0:
            return jsonify({
                "success": False,
                "error": "No symptoms selected"
            }), 400

        # Convert to DataFrame for model compatibility
        input_df = pd.DataFrame([feature_values])

        # Get probabilities if available
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_df)[0]
            predicted_index = probabilities.argmax()
            confidence = float(probabilities[predicted_index])
            prediction = model.classes_[predicted_index]

            return jsonify({
                "success": True,
                "predicted_disease": prediction,
                "confidence": confidence,
                "all_probabilities": {
                    str(model.classes_[i]): float(probabilities[i])
                    for i in range(len(probabilities))
                }
            })
        else:
            prediction = model.predict(input_df)[0]
            return jsonify({
                "success": True,
                "predicted_disease": prediction,
                "confidence": None
            })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)