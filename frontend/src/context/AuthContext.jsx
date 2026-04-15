import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { authApi } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearLocalAuth = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common.Authorization;
  }, []);

  const login = (userData, token = null) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData)); // Store user data in localStorage
    if (token) {
      localStorage.setItem("token", token);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    clearLocalAuth();
  };

  const refreshAuthStatus = useCallback(async () => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      } catch {
        clearLocalAuth();
      }
    }

    try {
      const res = await authApi.status();
      const loggedIn = Boolean(res?.data?.ifLogin);

      if (!loggedIn) {
        clearLocalAuth();
        return;
      }

      setIsAuthenticated(true);
      if (loggedIn) {
        const statusUser = res?.data?.user || null;
        const currentStored = localStorage.getItem("user");
        if (statusUser && !currentStored) {
          setUser(statusUser);
          localStorage.setItem("user", JSON.stringify(statusUser));
        } else if (currentStored) {
          setUser(JSON.parse(currentStored));
        }
        if (token) {
          axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        }
      }
    } catch (_) {
      if (!storedUser || !token) {
        clearLocalAuth();
      }
    } finally {
      setLoading(false);
    }
  }, [clearLocalAuth]);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        loading,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
