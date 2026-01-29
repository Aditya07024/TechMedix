import { Platform } from "react-native";

const getBaseURL = () => {
  if (__DEV__ && Platform.OS === "android") return "http://10.0.2.2:8080";
  if (__DEV__ && Platform.OS === "ios") return "http://127.0.0.1:8080";
  return "http://127.0.0.1:8080";
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || getBaseURL();