import { StyleSheet, Platform } from "react-native";

export const lightColors = {
  surface: "#f4faff",
  surfaceLow: "#e7f6ff",
  surfaceLowest: "#ffffff",
  surfaceHigh: "#daebf5",
  surfaceHighest: "#d5e5ef",
  primary: "#00535b",
  primaryContainer: "#006d77",
  primaryFixed: "#9ff0fb",
  secondary: "#236863",
  secondaryContainer: "#a9ece5",
  secondaryFixed: "#acefe7",
  tertiary: "#743b24",
  tertiaryContainer: "#915239",
  tertiaryFixed: "#ffdbce",
  outline: "#6f797a",
  outlineVariant: "#bec8ca",
  onSurface: "#0e1d25",
  onSurfaceVariant: "#3e494a",
  onPrimary: "#ffffff",
  onSecondaryContainer: "#286d67",
  success: "#198754",
  warning: "#b8691b",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  successSoft: "#e3f6ea",
  warningSoft: "#fff1e6",
  infoSoft: "#eaf8ff",
  shadow: "rgba(14, 29, 37, 0.06)",
};

export const darkColors = {
  surface: "#0f172a", // slate 900
  surfaceLow: "#1e293b", // slate 800
  surfaceLowest: "#020617", // slate 950
  surfaceHigh: "#334155", // slate 700
  surfaceHighest: "#475569", // slate 600
  primary: "#2dd4bf", // teal 400
  primaryContainer: "#0d9488", // teal 600
  primaryFixed: "#2dd4bf",
  secondary: "#14b8a6", // teal 500
  secondaryContainer: "#115e59",
  secondaryFixed: "#0f766e",
  tertiary: "#f97316",
  tertiaryContainer: "#c2410c",
  tertiaryFixed: "#ea580c",
  outline: "#94a3b8", // slate 400
  outlineVariant: "#475569",
  onSurface: "#f8fafc", // slate 50
  onSurfaceVariant: "#cbd5e1", // slate 300
  onPrimary: "#020617",
  onSecondaryContainer: "#ccfbf1",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  errorContainer: "#7f1d1d",
  successSoft: "#14532d",
  warningSoft: "#78350f",
  infoSoft: "#1e3a8a",
  shadow: "rgba(0, 0, 0, 0.4)",
};

let activeColors = lightColors;

export function updateActiveColors(newColors) {
  activeColors = newColors;
}

export const colors = {};
for (const key of Object.keys(lightColors)) {
  Object.defineProperty(colors, key, {
    get() {
      return activeColors[key];
    },
    enumerable: true,
    configurable: true
  });
}

function normalizeColor(c) {
  if (!c || typeof c !== "string") return c;
  let str = c.trim().toLowerCase();
  if (str === "white") return "#ffffff";
  if (str === "black") return "#000000";
  if (str.startsWith("#")) {
    if (str.length === 4) {
      return "#" + str[1] + str[1] + str[2] + str[2] + str[3] + str[3];
    }
  }
  return str;
}

function cloneAndTranslate(obj, toTheme) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cloneAndTranslate(item, toTheme));
  }
  const result = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string") {
      const valNormalized = normalizeColor(val);
      let matchedKey = null;
      for (const [colorKey, lightVal] of Object.entries(lightColors)) {
        if (valNormalized === normalizeColor(lightVal)) {
          matchedKey = colorKey;
          break;
        }
      }
      if (matchedKey) {
        result[key] = toTheme[matchedKey];
      } else {
        result[key] = val;
      }
    } else if (typeof val === "object") {
      result[key] = cloneAndTranslate(val, toTheme);
    } else {
      result[key] = val;
    }
  }
  return result;
}

const originalCreate = StyleSheet.create;

if (!StyleSheet.create.__isThemeWrapped) {
  const themeWrapper = (obj) => {
    // Generate compiled light and dark stylesheets
    const objLight = cloneAndTranslate(obj, lightColors);
    const objDark = cloneAndTranslate(obj, darkColors);

    const sheetLight = originalCreate ? originalCreate(objLight) : objLight;
    const sheetDark = originalCreate ? originalCreate(objDark) : objDark;

    const proxySheet = {};
    for (const styleName of Object.keys(obj)) {
      Object.defineProperty(proxySheet, styleName, {
        get() {
          const isDark = activeColors !== lightColors;
          const currentSheet = isDark ? sheetDark : sheetLight;
          return currentSheet[styleName];
        },
        enumerable: true,
        configurable: true
      });
    }
    return proxySheet;
  };

  themeWrapper.__isThemeWrapped = true;
  StyleSheet.create = themeWrapper;
}

export const spacing = {
  xs: 6,
  sm: 9,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 40,
};

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};

export const typography = {
  display: 36,
  h1: 30,
  h2: 24,
  h3: 20,
  title: 17,
  body: 15,
  bodySmall: 13,
  label: 11,
};

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  gradient: [colors.primary, colors.primaryContainer],
  navigationTheme: {
    dark: false,
    colors: {
      primary: colors.primary,
      background: colors.surface,
      card: colors.surfaceLowest,
      text: colors.onSurface,
      border: colors.surfaceLow,
      notification: colors.tertiary,
    },
    fonts: Platform.select({
      web: {
        regular: {
          fontFamily:
            'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
          fontWeight: "400",
        },
        medium: {
          fontFamily:
            'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
          fontWeight: "500",
        },
        bold: {
          fontFamily:
            'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
          fontWeight: "600",
        },
        heavy: {
          fontFamily:
            'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
          fontWeight: "700",
        },
      },
      ios: {
        regular: {
          fontFamily: "System",
          fontWeight: "400",
        },
        medium: {
          fontFamily: "System",
          fontWeight: "500",
        },
        bold: {
          fontFamily: "System",
          fontWeight: "600",
        },
        heavy: {
          fontFamily: "System",
          fontWeight: "700",
        },
      },
      default: {
        regular: {
          fontFamily: "sans-serif",
          fontWeight: "normal",
        },
        medium: {
          fontFamily: "sans-serif-medium",
          fontWeight: "normal",
        },
        bold: {
          fontFamily: "sans-serif",
          fontWeight: "600",
        },
        heavy: {
          fontFamily: "sans-serif",
          fontWeight: "700",
        },
      },
    }),
  },
};
