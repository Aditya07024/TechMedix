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

const makeStyleObject = (rawStyle) => {
  const styleObj = {};
  for (const prop of Object.keys(rawStyle)) {
    const val = rawStyle[prop];
    if (typeof val === "string") {
      const valLower = val.toLowerCase();
      let matchedKey = null;
      for (const [key, lightVal] of Object.entries(lightColors)) {
        if (valLower === lightVal.toLowerCase()) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey) {
        Object.defineProperty(styleObj, prop, {
          get() {
            return activeColors[matchedKey];
          },
          enumerable: true,
          configurable: true
        });
        continue;
      }
    }
    
    Object.defineProperty(styleObj, prop, {
      value: val,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return styleObj;
};

if (!StyleSheet.create.__isThemeWrapped) {
  const originalCreate = StyleSheet.create;

  const themeWrapper = (obj) => {
    const sheet = originalCreate ? originalCreate(obj) : obj;
    const proxySheet = {};
    for (const styleName of Object.keys(sheet)) {
      const rawStyle = sheet[styleName];
      if (rawStyle && typeof rawStyle === "object") {
        proxySheet[styleName] = makeStyleObject(rawStyle);
      } else {
        proxySheet[styleName] = rawStyle;
      }
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
