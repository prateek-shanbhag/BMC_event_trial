import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { currentUser, role, login, firebaseReady, authError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // If already authenticated and role is fetched, redirect to dashboard
  if (currentUser && role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  if (currentUser && role === 'PARTICIPANT') {
    return <Navigate to="/participant" replace />;
  }

  if (!firebaseReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="bmc-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div className="bmc-logo-mark" style={{ margin: '0 auto 1rem auto' }}>BMC</div>
          <h2 style={{ marginBottom: '0.5rem' }}>BMC Investment Simulator</h2>
          <div className="alert alert-error" style={{ justifyContent: 'center' }}>
            <span>Firebase configuration is missing or invalid.</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Please verify your credentials in <code>frontend/.env</code> to proceed.
          </p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      await login(email, password);
      // Let AuthContext fetch the role, which triggers re-render and the <Navigate> above
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to sign in. Please try again later.');
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative'
    }}>
      <div className="bmc-card animate-fade-in" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.25rem 2rem',
        boxShadow: 'var(--shadow-lg), 0 0 40px -10px rgba(56, 189, 248, 0.15)',
        border: '1px solid rgba(148, 163, 184, 0.18)'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="bmc-logo-mark" style={{
            margin: '0 auto 1rem auto',
            width: '46px',
            height: '46px',
            fontSize: '1.35rem'
          }}>
            BMC
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
            Investment Simulation
          </h2>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--accent-electric)',
            textTransform: 'uppercase'
          }}>
            Trading Terminal Access
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error" role="alert">
            <span style={{ fontWeight: 600 }}>Error:</span> {error}
          </div>
        )}
        {authError && (
          <div className="alert alert-error" role="alert">
            <span style={{ fontWeight: 600 }}>Auth:</span> {authError}
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="email-input">
              Account Email
            </label>
            <input 
              id="email-input"
              className="form-input"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="name@organization.com"
              required 
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="password-input">
              Password
            </label>
            <input 
              id="password-input"
              className="form-input"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••••••"
              required 
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoggingIn} 
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isLoggingIn ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge-dot" style={{ background: '#fff', animation: 'pulse-dot 1s infinite' }} />
                Authenticating...
              </span>
            ) : (
              'Sign In to Terminal'
            )}
          </button>
        </form>

        {/* Terminal Info Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          Authorized BMC Event Access Only &bull; Round Data Synced
        </div>
      </div>
    </div>
  );
}

export default Login;
