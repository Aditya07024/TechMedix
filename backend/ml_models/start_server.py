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
        symptoms = data.get('symptoms', {})
        
        # Convert symptoms to model input format
        # Modify this according to your model's requirements
        prediction = model.predict([list(symptoms.values())])
        
        return jsonify({
            'success': True,
            'prediction': prediction[0]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)