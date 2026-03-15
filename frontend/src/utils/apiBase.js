const rawApiUrl = import.meta.env.VITE_API_URL || "";

export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

const BACKEND_PATH_PREFIXES = [
  "/api",
  "/auth",
  "/aipop",
  "/new",
  "/allmedicines",
  "/medicines",
  "/prescription",
];

export function isBackendPath(value) {
  if (typeof value !== "string") return false;
  return BACKEND_PATH_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(`${prefix}/`),
  );
}

export function toBackendUrl(value) {
  if (!value || typeof value !== "string") return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (!API_BASE_URL) return value;
  if (!isBackendPath(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
