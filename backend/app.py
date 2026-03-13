# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/predict-disease", methods=["POST"])
def predict_disease():
    try:
        data = request.get_json(silent=True) or {}
        symptoms = data.get("symptoms", {})

        if not isinstance(symptoms, dict):
            return jsonify({"error": "Symptoms must be an object"}), 400

        # Prevent very large payloads
        if len(str(symptoms)) > 3000:
            return jsonify({"error": "Input too large"}), 400

        # Normalize symptom input (support boolean or 1/0)
        normalized = []
        for key, value in symptoms.items():
            if value in [1, True, "1", "true", "True"]:
                normalized.append(key.lower().strip())

        if not normalized:
            return jsonify({"error": "No symptoms provided"}), 400

        # Mock logic using normalized symptoms
        if "fever" in normalized or "cough" in normalized:
            result = {
                "predicted_disease": "Common Cold",
                "confidence": 0.92,
                "related_symptoms": ["sore throat", "runny nose", "headache"],
                "all_probabilities": {
                    "Common Cold": 0.92,
                    "Unknown Condition": 0.08
                }
            }
        else:
            result = {
                "predicted_disease": "Unknown Condition",
                "confidence": 0.5,
                "related_symptoms": [],
                "all_probabilities": {
                    "Common Cold": 0.08,
                    "Unknown Condition": 0.92
                }
            }

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": "Prediction failed", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)