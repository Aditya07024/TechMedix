export function cleanOCRText(text) {
  if (!text) return "";

  return text
    // Normalize unicode characters
    .normalize("NFKD")

    // Remove trademark and noise symbols
    .replace(/[|©®™•·]/g, " ")

    // Fix common OCR mistakes
    .replace(/0(?=mg)/gi, "O")          // 0mg → Omg (brand names)
    .replace(/(?<=\d)O(?=mg)/gi, "0")  // 5Omg → 50mg
    .replace(/l(?=\d)/gi, "1")         // l0 → 10

    // Normalize spacing around units
    .replace(/(\d)(mg|ml|mcg|g)/gi, "$1 $2")

    // Remove weird characters but keep medical punctuation
    .replace(/[^a-zA-Z0-9\s.,:/()%-]/g, " ")

    // Remove extra spaces
    .replace(/\s{2,}/g, " ")

    // Clean excessive newlines
    .replace(/\n{2,}/g, "\n")

    .trim();
}