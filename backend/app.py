# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/predict-disease", methods=["POST"])
def predict_disease():
    data = request.get_json()
    symptoms = data.get("symptoms", {})

    if not symptoms:
        return jsonify({"error": "No symptoms provided"}), 400

    # Simple mock logic (replace with your ML model later)
    if "fever" in symptoms or "cough" in symptoms:
        result = {
            "predicted_disease": "Common Cold",
            "confidence": 0.92,
            "related_symptoms": ["sore throat", "runny nose", "headache"]
        }
    else:
        result = {
            "predicted_disease": "Unknown Condition",
            "confidence": 0.5,
            "related_symptoms": []
        }

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)