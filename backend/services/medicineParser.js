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

/* ---------- FLEXIBLE PARSER (for BART output + raw prescription lines) ---------- */
const SKIP_PATTERNS = /^(dea|lic|medical|address|name|age|signature|refill|date|doctor|dr\.|patient)/i;
const DOSAGE_PATTERN = /(\d+\s*(?:mg|ml|mcg|g|iu|units?))(?!\d)/gi;
const FREQ_PATTERNS = [
  { pattern: /\b(BID|twice daily|2x daily)\b/i, value: "Twice daily" },
  { pattern: /\b(OD|once daily|1x daily|daily)\b/i, value: "Once daily" },
  { pattern: /\b(TDS|tid|3x daily|three times)\b/i, value: "3 times daily" },
  { pattern: /\b(QID|qid|4x daily|four times)\b/i, value: "4 times daily" },
  { pattern: /\b(HS|at bedtime|nightly)\b/i, value: "At bedtime" },
  { pattern: /\b(SOS|as needed|prn)\b/i, value: "As needed" },
];

function extractFrequencyFlexible(line) {
  for (const { pattern, value } of FREQ_PATTERNS) {
    if (pattern.test(line)) return value;
  }
  return null;
}

function extractDosageFlexible(line) {
  const m = line.match(/(\d+\s*(?:mg|ml|mcg|g|iu|units?))/i);
  return m ? m[1].trim() : null;
}

function extractNameFlexible(line) {
  let cleaned = line
    .replace(/(\d+\s*(?:mg|ml|mcg|g|iu|units?))(?!\d)/gi, " ")
    .replace(/\b(od|bd|tds|qid|hs|sos|bid|tid|prn)\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length > 1);
  const name = words.slice(0, 3).join(" "); // Up to 3 words for compound names
  return name.length >= 3 ? name : null;
}

/**
 * Extract medicines from any text (BART summary, raw OCR, etc.).
 * More permissive than parsePrescriptionText - works without tab/cap/syp.
 */
export function extractMedicinesFromText(rawText) {
  if (!rawText) return [];

  const lines = rawText.split(/[\n;]/).map((l) => l.trim()).filter(Boolean);
  const medicines = [];

  for (const line of lines) {
    if (line.length < 5) continue;
    if (SKIP_PATTERNS.test(line)) continue;

    // Must look like a medicine: has letters + (dosage OR frequency)
    const hasDosage = /(\d+\s*(?:mg|ml|mcg|g|iu|units?))(?!\d)/i.test(line);
    const hasFreq = FREQ_PATTERNS.some(({ pattern }) => pattern.test(line));
    if (!hasDosage && !hasFreq) continue;

    const med = {
      medicine_name: extractNameFlexible(line),
      dosage: extractDosageFlexible(line),
      frequency: extractFrequencyFlexible(line),
      duration: null,
      instructions: null,
      confidence: 0.75,
    };

    if (!med.medicine_name || med.medicine_name.length < 3) continue;

    med.confidence = 0.5 + (med.dosage ? 0.15 : 0) + (med.frequency ? 0.15 : 0);
    medicines.push(med);
  }

  return medicines;
}