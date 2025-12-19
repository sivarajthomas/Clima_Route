import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = ({ children, roleRequired }: { children?: React.ReactNode, roleRequired?: 'admin' | 'user' }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to the Unified Login Page (/) if not authenticated
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (roleRequired && user?.role !== roleRequired) {
    // Redirect to appropriate dashboard based on role if trying to access unauthorized area
    return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};