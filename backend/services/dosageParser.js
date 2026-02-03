export function parseDosage(dosageText) {
  if (!dosageText) return null;

  // Examples:
  // "500mg" → 500
  // "1 tablet (500mg)" → 500
  // "1/2 tablet 250mg" → 250

  const mgMatch = dosageText.match(/(\d+)\s*mg/i);
  if (mgMatch) return parseInt(mgMatch[1], 10);

  return null; // fallback (non-mg dosage)
}