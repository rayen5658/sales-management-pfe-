import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

/**
 * ProtectedRoute
 * - requiredRole: string | string[] — one or more allowed roles
 * - If not authenticated → /login
 * - If authenticated but wrong role → /dashboard
 */
export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(user?.role_name)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
