import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, LayoutAnimation, UIManager, Platform, View, Text, Animated, StyleSheet, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, updateActiveColors } from "../theme/tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THEME_MODE_KEY = "techmedix.theme.mode";
const { width, height } = Dimensions.get("window");

function ThemeOverlay({ direction, onFinished }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(direction === "to-dark" ? 80 : 0)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Scale and rotate
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Slide mask (moon eclipse morph)
    Animated.timing(slideAnim, {
      toValue: direction === "to-dark" ? 18 : 100, // Move mask in to make crescent, or move out to reveal sun
      duration: 850,
      delay: 150,
      useNativeDriver: true,
    }).start();

    // Fade out and cleanup
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onFinished();
      });
    }, 1100);
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const isToDark = direction === "to-dark";
  const bg = isToDark ? "#0b132b" : "#e2f1f8";
  const textColor = isToDark ? "#2dd4bf" : "#00535b";

  return (
    <Animated.View style={[overlayStyles.overlay, { backgroundColor: bg, opacity: fadeAnim }]}>
      <View style={overlayStyles.container}>
        <Animated.View style={{ transform: [{ rotate: spin }, { scale: scaleAnim }], width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {/* Sun/Moon Core */}
          <View style={[
            overlayStyles.core, 
            { 
              backgroundColor: isToDark ? "#cbd5e1" : "#fdb813",
              shadowColor: isToDark ? "#94a3b8" : "#f39c12",
              shadowRadius: 20,
              shadowOpacity: 0.8,
            }
          ]} />
          {/* Mask circle that slides to cut the core */}
          <Animated.View style={[
            overlayStyles.mask,
            {
              backgroundColor: bg,
              transform: [{ translateX: slideAnim }],
            }
          ]} />
        </Animated.View>
        <Text style={[overlayStyles.text, { color: textColor }]}>
          {isToDark ? "Entering the Sanctuary..." : "Rising with the Sun..."}
        </Text>
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    alignItems: "center",
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 10,
  },
  mask: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 20,
    left: 20,
  },
  text: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 35,
  },
});

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' or 'dark'
  const [mode, setMode] = useState("system"); // 'system', 'light', 'dark'
  const [animating, setAnimating] = useState(false);
  const [animDirection, setAnimDirection] = useState("to-dark");

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

  const toggleTheme = () => {
    if (animating) return;
    const nextDark = !isDark;
    setAnimDirection(nextDark ? "to-dark" : "to-light");
    setAnimating(true);

    // Toggle mode theme halfway
    setTimeout(() => {
      const nextMode = nextDark ? "dark" : "light";
      changeMode(nextMode);
    }, 500);
  };

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode: changeMode, toggleTheme }}>
      {children}
      {animating && (
        <ThemeOverlay direction={animDirection} onFinished={() => setAnimating(false)} />
      )}
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
