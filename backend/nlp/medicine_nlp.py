from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import re

app = Flask(__name__)
CORS(app)

# Load model safely
try:
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    raise RuntimeError("SpaCy model not found. Run: python -m spacy download en_core_web_sm")

FREQ_MAP = {
    "od": "Once daily",
    "bd": "Twice daily",
    "tds": "3 times daily",
    "qid": "4 times daily",
    "hs": "At bedtime",
    "sos": "As needed"
}

MED_HINTS = ["tab", "tablet", "cap", "capsule", "syp", "inj"]

MAX_TEXT_LENGTH = 5000


def clean_text(text):
    text = re.sub(r"[^a-zA-Z0-9\s./]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/parse-medicines", methods=["POST"])
def parse_medicines():
    try:
        if not request.json or "text" not in request.json:
            return jsonify({"error": "Missing text field"}), 400

        raw_text = request.json.get("text", "")

        if len(raw_text) > MAX_TEXT_LENGTH:
            return jsonify({"error": "Input too large"}), 400

        cleaned = clean_text(raw_text)
        doc = nlp(cleaned)

        medicines = []

        for sent in doc.sents:
            s = sent.text.lower()

            if not any(h in s for h in MED_HINTS):
                continue

            # dosage extraction
            dosage_match = re.search(r"\d+\s?(mg|ml|mcg|g)", s)
            dosage = dosage_match.group(0) if dosage_match else None

            # frequency extraction
            frequency = None
            for k, v in FREQ_MAP.items():
                if re.search(rf"\b{k}\b", s):
                    frequency = v
                    break

            if not frequency:
                frequency = "Not specified"

            # name cleaning
            name = re.sub(r"(tab|tablet|cap|capsule|syp|inj)", "", s)
            name = re.sub(r"\d+\s?(mg|ml|mcg|g)", "", name)
            name = re.sub(r"\b(od|bd|tds|qid|hs|sos)\b", "", name)
            name = name.strip().title()

            if len(name) < 3:
                continue

            confidence = 0.7
            if dosage:
                confidence += 0.1
            if frequency != "Not specified":
                confidence += 0.1

            medicines.append({
                "medicine_name": name,
                "dosage": dosage,
                "frequency": frequency,
                "confidence": round(confidence, 2)
            })

        return jsonify(medicines), 200

    except Exception as e:
        return jsonify({"error": "Parsing failed"}), 500


if __name__ == "__main__":
    app.run(port=5005)