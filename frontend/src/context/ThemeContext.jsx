import React, { createContext, useState, useContext, useEffect } from "react";

const ThemeContext = createContext();
const THEME_STORAGE_KEY = "techmedix-dark-mode";

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === "true";
    } catch (error) {
      console.error("Failed to read theme preference:", error);
      return false;
    }
  });

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, String(isDarkMode));
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
