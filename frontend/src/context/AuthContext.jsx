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
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common.Authorization;
  };

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await authApi.status();
      const loggedIn = Boolean(res?.data?.ifLogin);
      setIsAuthenticated(loggedIn);
      if (loggedIn) {
        const stored = localStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));
        const token = localStorage.getItem("token");
        if (token) {
          axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        }
      } else {
        setUser(null);
        localStorage.removeItem("token");
        delete axios.defaults.headers.common.Authorization;
      }
    } catch (_) {
      setIsAuthenticated(false);
      setUser(null);
      delete axios.defaults.headers.common.Authorization;
    } finally {
      setLoading(false);
    }
  }, []);

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
