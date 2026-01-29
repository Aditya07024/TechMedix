// Backend API base URL
// - iOS Simulator: use 127.0.0.1 (localhost can fail due to IPv6)
// - Android Emulator: http://10.0.2.2:8080
// - Physical device: set EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:8080
import { Platform } from "react-native";

const getDefaultBaseURL = () => {
  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:8080";
  }
  // Use 127.0.0.1 for iOS Simulator to avoid localhost resolving to IPv6 (::1)
  if (__DEV__ && Platform.OS === "ios") {
    return "http://127.0.0.1:8080";
  }
  return "http://127.0.0.1:8080";
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || getDefaultBaseURL();
