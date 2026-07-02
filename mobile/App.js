import "react-native-gesture-handler";
import React from "react";
import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { theme } from "./src/theme/tokens";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`expo-notifications` functionality is not fully supported in Expo Go",
  "[expo-av]: Expo AV has been deprecated",
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={theme.navigationTheme}>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
