export function getTimesFromFrequency(freq) {
  const map = {
    OD: ["08:00"],
    BD: ["08:00", "20:00"],
    TDS: ["08:00", "14:00", "20:00"],
    QID: ["06:00", "12:00", "18:00", "00:00"],
  };
  return map[freq?.toUpperCase()] || ["08:00"];
}