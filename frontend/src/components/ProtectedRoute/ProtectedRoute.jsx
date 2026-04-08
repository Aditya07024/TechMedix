// filepath: frontend/src/components/ProtectedRoute/ProtectedRoute.jsx
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // alert("Please login first");
    }
    // If a required role is specified and the user's role doesn't match
    if (
      !loading &&
      isAuthenticated &&
      requiredRole &&
      user?.role !== requiredRole
    ) {
      alert(
        `Access denied. You need to be a ${requiredRole} to view this page.`
      );
    }
  }, [loading, isAuthenticated, requiredRole, user]);

  if (loading) {
    return (
      <div className="app-route-loading">
        <div className="app-route-loading-card">
          <div className="app-route-loading-spinner" />
          <h2>Opening your dashboard</h2>
          <p>Checking your session and preparing the page.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Check role if requiredRole is provided
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <Navigate to="/" replace state={{ from: location }} /> // Redirect to home or an unauthorized page
    );
  }

  return children;
};

export default ProtectedRoute;
