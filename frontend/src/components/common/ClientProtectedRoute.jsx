import React from 'react';
import { Navigate } from 'react-router-dom';
import { useClientAuthStore } from '../../stores/clientAuthStore';

export default function ClientProtectedRoute({ children }) {
  const { isAuthenticated } = useClientAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/client/login" replace />;
  }
  return children;
}
