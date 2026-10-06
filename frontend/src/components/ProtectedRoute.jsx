import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireRole }) => {
  const { currentUser, role } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && role !== requireRole) {
    if (role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (role === 'PARTICIPANT') {
      return <Navigate to="/participant" replace />;
    } else {
      return <div>Unauthorized</div>;
    }
  }

  return children;
};
