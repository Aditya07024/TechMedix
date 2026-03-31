import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setAuthToken } from "../lib/api";

const SESSION_KEY = "techmedix.mobile.session";

const AuthContext = createContext(null);

async function persistSession(session) {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function readSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const stored = await readSession();
        if (!stored?.token) return;

        setAuthToken(stored.token);
        const status = await api.auth.status();
        if (!status?.ifLogin) {
          setAuthToken(null);
          await persistSession(null);
          return;
        }

        const nextSession = {
          token: stored.token,
          role: stored.role || status.role,
          user: stored.user || status.user,
        };

        if (!cancelled) {
          setSession(nextSession);
        }
      } catch {
        setAuthToken(null);
        await persistSession(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function commitSession(payload) {
    const normalizedUser = {
      ...payload.user,
      // Use UUID directly (backend expects UUID)
      patientId: payload.user?.id,
    };

    const nextSession = {
      token: payload.token,
      role: payload.role,
      user: normalizedUser,
    };
    setAuthToken(payload.token);
    setSession(nextSession);
    await persistSession(nextSession);
    return nextSession;
  }

  async function signInPatient(credentials) {
    const response = await api.auth.patientLogin(credentials);
    return commitSession({
      token: response.token,
      role: response.role || "patient",
      user: response.user,
    });
  }

  async function signUpPatient(payload) {
    await api.auth.patientSignup(payload);
    return signInPatient({ email: payload.email, password: payload.password });
  }

  async function signInDoctor(credentials) {
    const response = await api.auth.doctorLogin(credentials);
    return commitSession({
      token: response.token,
      role: response.role || "doctor",
      user: response.user,
    });
  }

  async function signUpDoctor(payload) {
    await api.auth.doctorSignup(payload);
    return signInDoctor({ email: payload.email, password: payload.password });
  }

  async function refreshDoctorProfile() {
    if (session?.role !== "doctor") return session?.user || null;
    const response = await api.auth.doctorProfile();
    const updatedUser = response?.data || response?.user || session.user;
    const nextSession = { ...session, user: updatedUser };
    setSession(nextSession);
    await persistSession(nextSession);
    return updatedUser;
  }

  async function signOut() {
    try {
      await api.auth.logout();
    } catch {}

    setAuthToken(null);
    setSession(null);
    await persistSession(null);
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      patientId: session?.user?.patientId || null,
      role: session?.role || null,
      token: session?.token || null,
      isAuthenticated: Boolean(session?.token),
      isLoading,
      signInPatient,
      signUpPatient,
      signInDoctor,
      signUpDoctor,
      refreshDoctorProfile,
      signOut,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
