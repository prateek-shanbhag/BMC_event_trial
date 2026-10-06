import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, role } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // If we are logged in but role hasn't loaded yet
  // AuthContext resolves both user and role before it stops loading, 
  // so if currentUser is present and role isn't, we show a fallback.
  if (!role) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // If the user's role is not in the allowed roles, redirect them based on their actual role
    if (role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/participant" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
