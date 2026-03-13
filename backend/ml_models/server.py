@app.route('/predict-disease', methods=['POST'])
def predict_disease():
    data = request.get_json()

    if not data or "symptoms" not in data:
        return jsonify({
            "error": "Symptoms not provided"
        }), 400

    symptoms_input = data.get('symptoms', {})

    if not isinstance(symptoms_input, dict):
        return jsonify({
            "error": "Symptoms must be an object"
        }), 400

    # Prepare model input
    input_test = [0] * len(l1)
    present_symptoms = []

    for symptom, present in symptoms_input.items():
        if symptom in l1 and present == 1:
            index = l1.index(symptom)
            input_test[index] = 1
            present_symptoms.append(symptom)

    if sum(input_test) == 0:
        return jsonify({
            "error": "No valid symptoms selected"
        }), 400

    input_df = pd.DataFrame([input_test], columns=l1)

    probabilities = clf4.predict_proba(input_df)[0]
    probs = probabilities
    predicted_index = np.argmax(probabilities)
    confidence = float(probabilities[predicted_index])

    predicted_disease = disease[predicted_index]

    # 🔒 Safety threshold
    CONFIDENCE_THRESHOLD = 0.55

    if confidence < CONFIDENCE_THRESHOLD:
        return jsonify({
            "predicted_disease": "Uncertain",
            "confidence": confidence,
            "requires_doctor_review": True,
            "message": "Low confidence prediction. Doctor consultation recommended."
        })

    return jsonify({
        "predicted_disease": predicted_disease,
        "confidence": confidence,
        "requires_doctor_review": False,
        "related_symptoms": present_symptoms[:5],
        "all_probabilities": dict(
            zip(disease, [float(p) for p in probs])
        )
    })