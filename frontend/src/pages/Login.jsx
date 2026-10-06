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
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1>BMC Investment Simulator</h1>
        <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>Firebase is not configured.</p>
        <p style={{ color: '#555' }}>Please add your Firebase credentials to <code>frontend/.env</code></p>
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
        setError('Network error. Please try again.');
      } else {
        setError('Failed to sign in. Please try again later.');
      }
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <div style={{ border: '1px solid #ddd', padding: '30px', borderRadius: '8px', width: '300px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '20px' }}>BMC Investment Simulator</h2>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: '20px', fontSize: '14px' }}>Sign in to continue</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoggingIn} 
            style={{ 
              padding: '10px', 
              marginTop: '10px', 
              backgroundColor: isLoggingIn ? '#a0c4ff' : '#0070f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: isLoggingIn ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}>
            {isLoggingIn ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {error && <div style={{ color: '#d32f2f', marginTop: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}
        {authError && <div style={{ color: '#d32f2f', marginTop: '15px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{authError}</div>}
      </div>
    </div>
  );
}

export default Login;
