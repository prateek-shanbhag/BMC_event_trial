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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bmc-card" style={{ padding: '2rem 3rem', textAlign: 'center' }}>
          <div className="bmc-logo-mark" style={{ margin: '0 auto 1rem auto' }}>BMC</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Verifying security credentials & role...</span>
          </div>
        </div>
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
