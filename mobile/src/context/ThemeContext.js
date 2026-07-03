import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, LayoutAnimation, UIManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, updateActiveColors } from "../theme/tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THEME_MODE_KEY = "techmedix.theme.mode";

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [systemScheme]);

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
