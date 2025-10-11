// filepath: frontend/src/components/ProtectedRoute/ProtectedRoute.jsx
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      alert('Please login first');
    }
  }, [loading, isAuthenticated]);

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <Navigate to="/home" replace state={{ from: location }} />
    );
  }

  return children;
};

export default ProtectedRoute;