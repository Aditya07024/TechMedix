export function parseDosage(dosageText) {
  if (!dosageText) return null;

  const text = dosageText.toString().trim().toLowerCase();

  // Match patterns like:
  // 500mg
  // 500 mg
  // 0.5 g
  // 250mcg
  const match = text.match(/(\d*\.?\d+)\s*(mg|g|mcg)/i);

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (isNaN(value)) return null;

  // Normalize everything to mg
  switch (unit) {
    case "mg":
      return value;
    case "g":
      return value * 1000;
    case "mcg":
      return value / 1000;
    default:
      return null;
  }
}