export function cleanOCRText(text) {
  return text
    .replace(/[|©®™]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/-\s+/g, "-")
    .replace(/\n{2,}/g, "\n")
    .trim();
}