import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getFlattenedPages } from '../utils/pageConfig';

/**
 * Protected Route Component
 * Usage: <ProtectedRoute role={["ADMIN", "MANAGER"]} element={<AdminPage />} />
 */
const ProtectedRoute = ({ element, role = null, redirectTo = '/branch-login' }) => {
  const { isAuthenticated, hasRole, user } = useAuth();
  const location = useLocation();

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if user has required role
  if (role && !hasRole(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ENFORCE GRANULAR PERMISSIONS (For non-Super Admins and non-Admins)
  if (user && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    const allPages = getFlattenedPages();
    // Find the page config for the current path
    const currentPage = allPages.find(p => p.path === location.pathname);
    
    // If it's a configured page, check if the user has it in their allowedPages
    if (currentPage && user.allowedPages && !user.allowedPages.includes(currentPage.id)) {
      console.warn(`🛑 Access denied for page: ${currentPage.id} (${location.pathname})`);
      return <Navigate to="/branch-home" replace />; // Redirect to home if no permission
    }
  }

  return element;
};

export default ProtectedRoute;
