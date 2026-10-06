import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady] = useState(!!auth);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!auth) {
      // Firebase is not configured — skip auth listener, just show the app
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthError(null);
      if (user) {
        try {
          const token = await user.getIdToken();
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setRole(data.role);
            setCurrentUser(user);
          } else {
            await signOut(auth);
            setCurrentUser(null);
            setRole(null);
            
            if (response.status === 404) {
              setAuthError("User not found in the database. Please contact an administrator.");
            } else if (response.status === 401 || response.status === 403) {
              setAuthError("Unauthorized to access the application.");
            } else {
              setAuthError(`Backend authentication failed with status: ${response.status}`);
            }
          }
        } catch (error) {
          console.error("Backend auth verification failed", error);
          await signOut(auth);
          setCurrentUser(null);
          setRole(null);
          setAuthError(`Network error connecting to backend: ${error.message}`);
        }
      } else {
        setCurrentUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    if (!auth) {
      return Promise.reject(new Error('Firebase is not configured.'));
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    if (!auth) {
      return Promise.reject(new Error('Firebase is not configured.'));
    }
    return signOut(auth);
  };

  const value = {
    currentUser,
    role,
    login,
    logout,
    loading,
    firebaseReady,
    authError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
