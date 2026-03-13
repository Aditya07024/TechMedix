from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from flask import Flask, request, jsonify
import torch
import json
from datetime import datetime

torch.set_grad_enabled(False)

app = Flask(__name__)

MODEL_NAME = "google/flan-t5-large"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

def analyze_vitals(ehr: dict):
    insights = []
    if not ehr:
        return insights

    try:
        hr = float(ehr.get("heartRate")) if ehr.get("heartRate") is not None else None
        spo2 = float(ehr.get("spo2")) if ehr.get("spo2") is not None else None
        temp = float(ehr.get("temperature")) if ehr.get("temperature") is not None else None
    except Exception:
        hr = None
        spo2 = None
        temp = None

    if hr is not None:
        if 60 <= hr <= 100:
            insights.append("• Heart rate appears within a normal resting range.")
        else:
            insights.append("• Heart rate appears outside the typical resting range.")

    if spo2 is not None:
        if spo2 >= 95:
            insights.append("• Oxygen saturation appears within a normal range.")
        else:
            insights.append("• Oxygen saturation appears lower than expected.")

    if temp is not None:
        if 36.1 <= temp <= 37.5:
            insights.append("• Body temperature appears within a normal range.")
        else:
            insights.append("• Body temperature appears outside the normal range.")

    return insights

@app.route("/insights", methods=["POST"])
def generate_insights():
    data = request.json or {}

    # Prevent very large payloads
    if len(str(data)) > 5000:
        return jsonify({"aiInsights": "• Input too large to process safely."}), 400

    symptoms = data.get("symptoms", {})
    ehr = data.get("ehr", {})
    medicines = data.get("medicines", [])
    prescription = data.get("prescription", [])

    prompt = f"""
You are a medical assistant.

Rules:
- Do NOT diagnose
- Do NOT suggest treatments or medicines
- Use clear bullet points only
- Keep observations neutral and factual
- Mention whether vitals look normal or abnormal

Symptoms: {symptoms}
EHR: {ehr}
Medicines: {medicines}
Prescription: {prescription}

Medical observations:
"""

    try:
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=1024
        ).to(device)
        outputs = model.generate(
            **inputs,
            max_new_tokens=160,
            do_sample=False,
            num_beams=4,
            repetition_penalty=1.2,
            early_stopping=True
        )

        ai_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    except Exception as e:
        ai_text = "• AI-generated insights are temporarily unavailable."

    vitals_insights = analyze_vitals(ehr)

    final_output = []
    banned_phrases = [
        "do not",
        "rules",
        "mention whether",
        "use clear",
        "keep observations",
        "medical observations"
    ]

    if ai_text:
        for line in ai_text.split("\n"):
            clean = line.strip()
            lower = clean.lower()

            if not clean:
                continue
            if any(bad in lower for bad in banned_phrases):
                continue

            clean = clean.lstrip("• ")
            clean = "• " + clean

            final_output.append(clean)

    final_output.extend(vitals_insights)

    if not final_output:
        final_output.append("• No significant observations could be generated from the provided data.")

    return jsonify({
        "aiInsights": "\n".join(dict.fromkeys(final_output))
    })

@app.route("/health-insights", methods=["POST"])
def health_insights():
    try:
        data = request.get_json()
        patient_id = data.get("patient_id")
        latest_metrics = data.get("latest_metrics", [])
        weekly_summary = data.get("weekly_summary", [])

        # Convert metrics to a readable format for AI
        health_data = {}
        for metric in latest_metrics:
            metric_type = metric.get("metric_type")
            value = metric.get("value")
            unit = metric.get("unit")
            recorded_at = metric.get("recorded_at")

            if metric_type and value is not None:
                health_data[metric_type] = {
                    "value": value,
                    "unit": unit,
                    "recorded_at": recorded_at
                }

        # Create prompt for AI
        prompt = f"""
        Analyze the following health metrics for a patient and provide personalized health insights and recommendations:

        Current Health Metrics:
        {json.dumps(health_data, indent=2)}

        Weekly Summary (averages):
        {json.dumps(weekly_summary, indent=2)}

        Please provide 3-5 specific, actionable health insights based on this data. Focus on:
        - Exercise and activity levels
        - Sleep quality and duration
        - Heart health indicators
        - Calorie burn and energy expenditure
        - Overall wellness trends

        Keep recommendations practical and encouraging. Format as bullet points.
        """

        # Generate insights using the model
        inputs = tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=300,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )

        insights_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Clean up the response
        insights = []
        for line in insights_text.split("\n"):
            line = line.strip()
            if line and not line.startswith("Analyze") and not line.startswith("Current") and not line.startswith("Weekly"):
                if line.startswith("- ") or line.startswith("• "):
                    insights.append(line)
                elif len(line) > 10:  # Filter out short fragments
                    insights.append(f"• {line}")

        # If AI generation failed, provide basic insights
        if not insights:
            insights = generate_basic_insights(health_data, weekly_summary)

        return jsonify({
            "insights": insights[:5],  # Limit to 5 insights
            "data_points": len(health_data),
            "generated_at": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Health insights error: {e}")
        return jsonify({
            "insights": ["Unable to generate personalized insights at this time. Please ensure your health data is up to date."]
        })

def generate_basic_insights(health_data, weekly_summary):
    """Generate basic insights when AI model fails"""
    insights = []

    # Steps analysis
    if "steps" in health_data:
        steps = health_data["steps"]["value"]
        if steps < 5000:
            insights.append("• Consider increasing daily steps to reach the recommended 10,000 steps for better cardiovascular health.")
        elif steps >= 10000:
            insights.append("• Excellent daily activity level! Keep up the good work with your step count.")

    # Sleep analysis
    if "sleep_duration" in health_data:
        sleep_hours = health_data["sleep_duration"]["value"]
        if sleep_hours < 7:
            insights.append("• Aim for 7-9 hours of sleep per night to support recovery and overall health.")
        elif sleep_hours >= 7:
            insights.append("• Good sleep duration! Consistent quality sleep is important for health.")

    # Heart rate analysis
    if "heart_rate" in health_data:
        hr = health_data["heart_rate"]["value"]
        if 60 <= hr <= 100:
            insights.append("• Resting heart rate is within a normal range.")
        else:
            insights.append("• Monitor your heart rate trends and consult with a healthcare provider if concerned.")

    # Calories analysis
    if "calories_burned" in health_data:
        calories = health_data["calories_burned"]["value"]
        insights.append(f"• You've burned approximately {calories} calories today through activity.")

    if not insights:
        insights.append("• Continue tracking your health metrics regularly for better insights.")

    return insights

@app.route("/health", methods=["GET"])
def health():
    return jsonify({ "status": "ok", "model": MODEL_NAME })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005)