import "react-native-gesture-handler";
import React from "react";
import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { theme } from "./src/theme/tokens";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`expo-notifications` functionality is not fully supported in Expo Go",
  "[expo-av]: Expo AV has been deprecated",
  "expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go",
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function AppContent() {
  const { colors, isDark } = useTheme();

  const dynamicNavTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.surface,
      card: colors.surfaceLowest,
      text: colors.onSurface,
      border: colors.surfaceLow,
      notification: colors.tertiary,
    },
    fonts: theme.navigationTheme.fonts,
  };

  return (
    <NavigationContainer theme={dynamicNavTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
