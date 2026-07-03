import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as lightColors, updateActiveColors } from "../theme/tokens";

const THEME_MODE_KEY = "techmedix.theme.mode";

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

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' or 'dark'
  const [mode, setMode] = useState("system"); // 'system', 'light', 'dark'

  useEffect(() => {
    async function loadThemeMode() {
      const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (saved) {
        setMode(saved);
      }
    }
    loadThemeMode();
  }, []);

  const changeMode = async (nextMode) => {
    setMode(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  // Keep tokens.js synchronized with the active palette
  useEffect(() => {
    updateActiveColors(colors);
  }, [isDark, colors]);

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode: changeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
