import React, { createContext, useState, useContext, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect system theme on first load
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (isDark) => {
      setIsDarkMode(isDark);
      document.body.classList.toggle("dark-mode", isDark);
    };

    applyTheme(prefersDark.matches); // Set initial

    // Listen for system theme changes
    const listener = (e) => {
      applyTheme(e.matches);
    };

    prefersDark.addEventListener("change", listener);

    return () => prefersDark.removeEventListener("change", listener);
  }, []);

  // Manual toggle
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.body.classList.toggle("dark-mode", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);