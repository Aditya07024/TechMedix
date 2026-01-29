import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config";

const TOKEN_KEY = "@techmedix_token";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Cookie = `token=${token}`;
  return config;
});

export const setAuthToken = (t) =>
  AsyncStorage.setItem(TOKEN_KEY, t);

export const clearAuthToken = () =>
  AsyncStorage.removeItem(TOKEN_KEY);

export default api;