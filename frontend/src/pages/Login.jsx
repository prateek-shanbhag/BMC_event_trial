import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import '../components/ui/ui.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);
  
  const { login, currentUser, role, loading } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect based on role
  if (currentUser && role) {
    if (role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (role === 'PARTICIPANT') return <Navigate to="/participant" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      return setError('Please enter both email and password.');
    }

    try {
      setLoadingLocal(true);
      const userCredential = await login(email, password);
      // AuthContext handles role fetching.
      // The ProtectedRoute and App.jsx routing logic will naturally take over once role is populated.
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="text-display">BMC</h1>
          <p className="text-label-caps">Investment Simulator</p>
        </div>
        
        <div className="card" style={{ padding: 'var(--space-2xl)' }}>
          <h2 className="text-headline-md" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>Sign In</h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label text-label-caps" htmlFor="email">Institutional Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@bmc.edu"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label text-label-caps" htmlFor="password">Access Code</label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              variant="primary" 
              className="w-full"
              style={{ marginTop: 'var(--space-md)' }}
              disabled={loading || loadingLocal}
            >
              {loading || loadingLocal ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
