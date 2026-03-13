// backend/services/summarizerService.js
// Hybrid: OCR correction → regex extraction → NER supplement
// Handles noisy handwritten/printed prescription OCR accurately.
// Fully offline — no API key required.

import { pipeline } from "@xenova/transformers";

const MEDICAL_NER_MODEL = "onnx-community/Medical-NER-ONNX";
const MAX_CHARS_PER_CHUNK = 3000;
const CHUNK_OVERLAP = 150;

let nerModel = null;
let nerPromise = null;

// ─── Model Loader ─────────────────────────────────────────────────────────────

async function getNerModel() {
  if (nerModel) return nerModel;
  if (!nerPromise) {
    console.log("📦 Loading Medical-NER-ONNX model...");
    nerPromise = pipeline("token-classification", MEDICAL_NER_MODEL, {
      aggregation_strategy: "simple",
    })
      .then((model) => {
        nerModel = model;
        console.log("✅ Medical NER model loaded:", MEDICAL_NER_MODEL);
        return nerModel;
      })
      .catch((err) => {
        nerPromise = null;
        throw err;
      });
  }
  return nerPromise;
}

// ─── Step 1: OCR Character Correction ────────────────────────────────────────

/**
 * Fix common OCR misreads BEFORE any parsing.
 * Targets character-level mistakes that break drug name and dosage recognition.
 */
function fixOcrErrors(text) {
  return text
    .replace(/\r\n/g, "\n")
    // Fix digit/letter confusion at START of words (e.g. "1isinopril" → "Lisinopril")
    .replace(/\b1([a-z])/g, (_, c) => "L" + c)        // 1isinopril → Lisinopril
    .replace(/\b0([a-z])/g, (_, c) => "O" + c)        // 0xprenolol → Oxprenolol
    // Fix dosage unit OCR errors (must come before general cleanup)
    .replace(/(\d)\s*m[g4q]/gi, "$1mg")               // 500m4 / 500mq → 500mg
    .replace(/(\d)\s*m[l1|]/gi, "$1ml")               // 10m1 / 10ml → 10ml
    .replace(/(\d)\s*mc[gq]/gi, "$1mcg")              // mcq → mcg
    // Fix lowercase l misread as I at word start
    .replace(/\bl([A-Z])/g, "I$1")                    // lBuprofen → IBuprofen (rare)
    .replace(/\b(l)([a-z]{3,})/g, (_, __, rest) => "I" + rest) // lbuprofen → Ibuprofen
    // Fix common word-level OCR frequency errors
    .replace(/\boily\b/gi, "daily")
    .replace(/\bdary\b/gi, "daily")
    .replace(/\bdaify\b/gi, "daily")
    .replace(/\bFree\s+Times?\b/gi, "Three Times")
    .replace(/\bToke\b/gi, "Take")
    .replace(/\bpaint\b/gi, "pain")
    // Remove stray symbols
    .replace(/[\\[\]|™~<>]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// ─── Step 2: Noise Line Filtering ────────────────────────────────────────────

// Lines that are definitely NOT medicine entries
const NOISE_PATTERNS = [
  /^PRESCRIPTION\s*$/i,
  /^DOCTOR\b/i,
  /^(DEA|LIC)\s*#/i,
  /^(NAME|AGE|DATE|ADDRESS|pate)\s*[:\-]?/i,
  /^(MEDICAL\s*CENTRE|CLINIC|HOSPITAL)/i,
  /^(REFILL|WTX|LABEL|PRN)\b/i,
  /^(Dr\.|Tr\.|Signature|signatur)/i,
  /^[^a-zA-Z]{0,2}$/,                  // lines with no real letters
  /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/, // pure date lines
];

function isNoiseLine(line) {
  return NOISE_PATTERNS.some(p => p.test(line.trim()));
}

// ─── Step 3: Medicine Line Detection ─────────────────────────────────────────

/**
 * Detect if a line is a medicine entry.
 * A medicine line starts with a capitalized drug name (3+ chars)
 * OR contains a dosage unit.
 */
function isMedicineLine(line) {
  const hasDrugName  = /^[A-Z][a-zA-Z]{2,}/.test(line.trim());
  const hasDosage    = /\d+\s*(mg|ml|mcg|g|%|IU|units?)/i.test(line);
  return hasDrugName || hasDosage;
}

/**
 * Detect if a line is a plain-English instruction/frequency line.
 * e.g. "Take one tablet daily", "Take one capsule three times daily"
 */
function isInstructionLine(line) {
  return /^(Take|Apply|Use|Give|Instil|Insert|Inhale)\b/i.test(line.trim());
}

// ─── Step 4: Frequency & Dosage Parsing ──────────────────────────────────────

const FREQ_ABBREV_MAP = {
  QD: "Once daily",    OD: "Once daily",
  BID: "Twice daily",  BD: "Twice daily",
  TID: "Three times daily", TDS: "Three times daily",
  QID: "Four times daily",  QDS: "Four times daily",
  PRN: "As needed",    SOS: "As needed",
  HS:  "At bedtime",   AC:  "Before meals",
  PC:  "After meals",  STAT: "Immediately",
};

const FREQ_ABBREV_RE = /\b(QD|OD|BID|BD|TID|TDS|QID|QDS|PRN|SOS|HS|AC|PC|STAT)\b/gi;

// Plain-English frequency patterns (handles OCR-corrected text)
const FREQ_ENGLISH_RE = [
  [/\bonce\s+(a\s+)?daily\b/i,             "Once daily"],
  [/\bonce\s+(a\s+)?day\b/i,               "Once daily"],
  [/\btwice\s+(a\s+)?daily\b/i,            "Twice daily"],
  [/\btwice\s+(a\s+)?day\b/i,              "Twice daily"],
  [/\bthree\s+times?\s+(a\s+)?(daily|day)\b/i, "Three times daily"],
  [/\bfour\s+times?\s+(a\s+)?(daily|day)\b/i,  "Four times daily"],
  [/\b(every|each)\s+day\b/i,              "Once daily"],
  [/\bdaily\b/i,                           "Once daily"],
  [/\bas\s+needed\b/i,                     "As needed"],
  [/\bwhen\s+required\b/i,                 "As needed"],
  [/\bat\s+bedtime\b/i,                    "At bedtime"],
];

const DOSAGE_RE   = /(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|%|IU|units?)/gi;
const DURATION_RE = /\b(\d+)\s*(day|days|week|weeks|month|months)\b/gi;

function parseFrequency(text) {
  // Check abbreviations first
  const abbrevMatch = text.match(FREQ_ABBREV_RE);
  if (abbrevMatch) {
    return FREQ_ABBREV_MAP[abbrevMatch[0].toUpperCase()] || abbrevMatch[0];
  }
  // Check plain English
  for (const [pattern, label] of FREQ_ENGLISH_RE) {
    if (pattern.test(text)) return label;
  }
  return null;
}

function parseDosage(text) {
  const matches = [...text.matchAll(DOSAGE_RE)];
  return matches.length > 0 ? matches.map(m => `${m[1]}${m[2].toLowerCase()}`).join(", ") : null;
}

function parseDuration(text) {
  const match = text.match(DURATION_RE);
  return match ? match[0] : null;
}

// ─── Step 5: Line-by-Line Regex Extraction ───────────────────────────────────

const SKIP_WORDS = new Set([
  "prescription", "medical", "centre", "clinic", "hospital",
  "street", "refill", "label", "signature", "doctor", "take",
  "apply", "use", "give", "instil", "insert", "inhale",
]);

/**
 * Main extraction logic.
 * Pairs medicine lines with their following instruction lines to get frequency.
 */
function regexExtract(correctedText) {
  const lines = correctedText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 1 && !isNoiseLine(l));

  console.log("\n📋 Filtered lines:\n", lines);

  const medicines = [];
  const seen = new Set();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isMedicineLine(line) && !isInstructionLine(line)) {
      // Extract drug name: first capitalized word group (no digits)
      const nameMatch = line.match(/^([A-Z][a-zA-Z]+(?:\s[a-zA-Z]+)?)/);
      const medicine_name = nameMatch ? nameMatch[1].trim() : null;

      if (!medicine_name) { i++; continue; }

      const key = medicine_name.toLowerCase();
      if (key.length < 3 || SKIP_WORDS.has(key)) { i++; continue; }
      if (seen.has(key)) { i++; continue; }
      seen.add(key);

      // Parse dosage from this line
      let dosage    = parseDosage(line);
      let frequency = parseFrequency(line);
      let duration  = parseDuration(line);
      let instructions = null;

      // Look ahead: if next line is an instruction, extract frequency from it
      if (i + 1 < lines.length && isInstructionLine(lines[i + 1])) {
        const instrLine = lines[i + 1];
        frequency    = frequency    || parseFrequency(instrLine);
        duration     = duration     || parseDuration(instrLine);
        dosage       = dosage       || parseDosage(instrLine);
        instructions = instrLine;   // store full instruction text
        i++;                        // skip the instruction line
      }

      medicines.push({
        medicine_name,
        dosage,
        frequency,
        duration,
        instructions,
        confidence: dosage || frequency ? 0.88 : 0.65,
      });
    }

    i++;
  }

  return medicines;
}

// ─── Step 6: NER Supplement ───────────────────────────────────────────────────

const MEDICINE_LABELS = new Set(["DRUG", "MEDICATION", "CHEMICAL"]);
const DOSAGE_LABELS   = new Set(["DOSAGE", "DOSE", "STRENGTH"]);
const FREQ_LABELS     = new Set(["FREQUENCY", "FREQ"]);
const DURATION_LABELS = new Set(["DURATION"]);

function normalizeLabel(raw) {
  return (raw || "").replace(/^[BI]-/i, "").toUpperCase().trim();
}

async function nerExtract(text) {
  const model = await getNerModel();
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + MAX_CHARS_PER_CHUNK, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }

  const entityArrays = await Promise.all(
    chunks.map(chunk =>
      Promise.race([
        model(chunk, { ignore_labels: [] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("NER timeout")), 60_000)),
      ]).then(r => Array.isArray(r) ? r : [])
    )
  );

  const allEntities = entityArrays.flat();
  console.log(`🧬 NER entities found: ${allEntities.length}`);

  const medicines = [];
  let current = null;

  for (const entity of allEntities) {
    const label = normalizeLabel(entity.entity_group || entity.entity);
    const word  = (entity.word || "").replace(/^##/, "").trim();
    if (!word || label === "O") continue;

    if (MEDICINE_LABELS.has(label)) {
      if (current) medicines.push(current);
      current = {
        medicine_name: word,
        dosage: null, frequency: null,
        duration: null, instructions: null,
        confidence: entity.score ?? 0.8,
      };
    } else if (current) {
      if (DOSAGE_LABELS.has(label))
        current.dosage = current.dosage ? `${current.dosage} ${word}` : word;
      else if (FREQ_LABELS.has(label))
        current.frequency = current.frequency ? `${current.frequency} ${word}` : word;
      else if (DURATION_LABELS.has(label))
        current.duration = current.duration ? `${current.duration} ${word}` : word;
    }
  }
  if (current) medicines.push(current);
  return medicines;
}

// ─── Step 7: Merge & Deduplicate ─────────────────────────────────────────────

function mergeMedicines(...sources) {
  const seen = new Set();
  const result = [];

  for (const source of sources) {
    for (const m of source) {
      const key = (m.medicine_name || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || key.length < 3 || seen.has(key)) continue;
      seen.add(key);
      result.push({
        medicine_name: m.medicine_name ?? null,
        dosage:        m.dosage        ?? null,
        frequency:     m.frequency     ?? null,
        duration:      m.duration      ?? null,
        instructions:  m.instructions  ?? null,
        confidence:    typeof m.confidence === "number" ? m.confidence : 0.75,
      });
    }
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured medicine data from noisy prescription OCR text.
 *
 * @param {string} ocrText - Raw OCR output from prescription image
 * @returns {{ medicines: Array }}
 */
export async function summarizePrescription(ocrText) {
  if (!ocrText?.trim()) throw new Error("No OCR text provided");

  // Step 1: Fix character-level OCR errors
  const correctedText = fixOcrErrors(ocrText);
  console.log("\n🧹 CORRECTED OCR TEXT:\n", correctedText);

  // Step 2: Regex extraction — primary, handles plain-English instructions
  const fromRegex = regexExtract(correctedText);
  console.log(`\n📌 Regex extracted ${fromRegex.length} medicine(s):`, fromRegex.map(m => m.medicine_name));

  // Step 3: NER supplement — catches anything regex missed
  let fromNer = [];
  try {
    fromNer = await nerExtract(correctedText);
    console.log(`📌 NER extracted ${fromNer.length} medicine(s):`, fromNer.map(m => m.medicine_name));
  } catch (err) {
    console.warn("⚠ NER failed, relying on regex only:", err.message);
  }

  // Step 4: Regex results take priority (higher precision on OCR noise)
  const medicines = mergeMedicines(fromRegex, fromNer);

  const parsed = { medicines };
  console.log("\n✅ FINAL EXTRACTED MEDICINES:\n");
  console.dir(parsed, { depth: null });
  return parsed;
}