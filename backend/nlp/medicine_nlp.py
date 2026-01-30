from flask import Flask, request, jsonify
import spacy
import re

app = Flask(__name__)
nlp = spacy.load("en_core_web_sm")

FREQ_MAP = {
    "od": "Once daily",
    "bd": "Twice daily",
    "tds": "3 times daily",
    "qid": "4 times daily",
    "hs": "At bedtime",
    "sos": "As needed"
}

MED_HINTS = ["tab", "tablet", "cap", "capsule", "syp", "inj"]

def clean_text(text):
    text = re.sub(r"[^a-zA-Z0-9\s./]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

@app.route("/parse-medicines", methods=["POST"])
def parse_medicines():
    data = request.json
    raw_text = data.get("text", "")

    cleaned = clean_text(raw_text)
    doc = nlp(cleaned)

    medicines = []

    for sent in doc.sents:
        s = sent.text.lower()

        if not any(h in s for h in MED_HINTS):
            continue

        # extract dosage
        dosage_match = re.search(r"\d+\s?(mg|ml|mcg|g)", s)
        dosage = dosage_match.group(0) if dosage_match else None

        # extract frequency
        frequency = None
        for k, v in FREQ_MAP.items():
            if re.search(rf"\b{k}\b", s):
                frequency = v
                break

        # extract name
        name = re.sub(r"(tab|tablet|cap|capsule|syp|inj)", "", s)
        name = re.sub(r"\d+\s?(mg|ml|mcg|g)", "", name)
        name = re.sub(r"\b(od|bd|tds|qid|hs|sos)\b", "", name)
        name = name.strip().title()

        if len(name) < 3:
            continue

        medicines.append({
            "medicine_name": name,
            "dosage": dosage,
            "frequency": frequency,
            "confidence": 0.75 + (0.1 if dosage else 0)
        })

    return jsonify(medicines)

if __name__ == "__main__":
    app.run(port=5005)