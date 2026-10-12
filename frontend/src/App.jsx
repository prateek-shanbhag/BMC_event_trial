
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ParticipantDashboard from './pages/ParticipantDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function RootRedirect() {
  const { currentUser, role } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  } else if (role === 'PARTICIPANT') {
    return <Navigate to="/participant" replace />;
  } else {
    // If role hasn't loaded yet or is invalid, just show loading or fallback
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bmc-card" style={{ padding: '2rem 3rem', textAlign: 'center' }}>
          <div className="bmc-logo-mark" style={{ margin: '0 auto 1rem auto' }}>BMC</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading user workspace...</span>
          </div>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/participant" 
          element={
            <ProtectedRoute allowedRoles={['PARTICIPANT']}>
              <ParticipantDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
