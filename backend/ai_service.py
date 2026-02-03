from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from flask import Flask, request, jsonify
import torch

app = Flask(__name__)

MODEL_NAME = "google/flan-t5-large"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
model.eval()

def analyze_vitals(ehr: dict):
    insights = []
    if not ehr:
        return insights

    hr = ehr.get("heartRate")
    spo2 = ehr.get("spo2")
    temp = ehr.get("temperature")

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
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True)
        with torch.no_grad():
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

            if not clean.startswith("•"):
                clean = "• " + clean

            final_output.append(clean)

    final_output.extend(vitals_insights)

    if not final_output:
        final_output.append("• No significant observations could be generated from the provided data.")

    return jsonify({
        "aiInsights": "\n".join(dict.fromkeys(final_output))
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({ "status": "ok", "model": MODEL_NAME })

if __name__ == "__main__":
    app.run(port=5005)