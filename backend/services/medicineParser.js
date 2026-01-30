const FREQUENCY_MAP = {
  OD: "Once daily",
  BD: "Twice daily",
  TDS: "3 times daily",
  QID: "4 times daily",
  HS: "At bedtime",
  SOS: "As needed",
};

const MED_FORM_REGEX = /(tab|cap|syp|inj)/i;
const DOSAGE_REGEX = /(\d+\s?(mg|ml|mcg|g))/i;

/* ---------- STRONG NORMALIZATION ---------- */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s./+-]/g, " ")
    .replace(/\btab(?=[a-z])/g, "tab ")   // TABHXONET → TAB HXONET
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- RX SECTION EXTRACT ---------- */
function extractRxBlock(text) {
  const lines = text.split("\n");

  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (/rx|tab|cap|syp/i.test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start === -1) return [];

  for (let i = start + 1; i < lines.length; i++) {
    if (/advice|plan|physio|follow/i.test(lines[i])) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end);
}

/* ---------- FIELD EXTRACTORS ---------- */
function extractFrequency(line) {
  for (const key in FREQUENCY_MAP) {
    if (new RegExp(`\\b${key}\\b`, "i").test(line)) {
      return FREQUENCY_MAP[key];
    }
  }
  return null;
}

function extractDosage(line) {
  const m = line.match(DOSAGE_REGEX);
  return m ? m[1] : null;
}

function extractName(line) {
  let cleaned = line
    .replace(MED_FORM_REGEX, "")
    .replace(DOSAGE_REGEX, "")
    .replace(/\b(od|bd|tds|qid|hs|sos)\b/gi, "")
    .replace(/\b\d+\b/g, "")
    .trim();

  const words = cleaned.split(" ");
  return words.slice(0, 2).join(" ").toUpperCase();
}

function confidenceScore({ medicine_name, frequency }) {
  let c = 0.5;
  if (medicine_name.length >= 4) c += 0.2;
  if (frequency) c += 0.2;
  return Math.min(c, 0.9);
}

/* ---------- MAIN PARSER ---------- */
export function parsePrescriptionText(rawText) {
  if (!rawText) return [];

  const normalized = normalize(rawText);
  const rxLines = extractRxBlock(normalized);

  const medicines = [];

  for (const line of rxLines) {
    if (!MED_FORM_REGEX.test(line)) continue;

    const med = {
      medicine_name: extractName(line),
      dosage: extractDosage(line),
      frequency: extractFrequency(line),
      duration: null,
      instructions: null,
    };

    if (!med.medicine_name || med.medicine_name.length < 4) continue;

    med.confidence = confidenceScore(med);
    medicines.push(med);
  }

  return medicines;
}