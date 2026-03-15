import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Protected Route Component
 * Usage: <ProtectedRoute role={["ADMIN", "MANAGER"]} element={<AdminPage />} />
 */
const ProtectedRoute = ({ element, role = null, redirectTo = '/branch-login' }) => {
  const { isAuthenticated, hasRole } = useAuth();

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has required role
  if (role && !hasRole(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return element;
};

export default ProtectedRoute;
