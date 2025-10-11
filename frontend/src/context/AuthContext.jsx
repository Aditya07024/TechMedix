import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await authApi.status();
      const loggedIn = Boolean(res?.data?.ifLogin);
      setIsAuthenticated(loggedIn);
      if (loggedIn) {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
      } else {
        setUser(null);
      }
    } catch (_) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, refreshAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);