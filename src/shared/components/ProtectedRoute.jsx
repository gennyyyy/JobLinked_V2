import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

function ProtectedRoute({ role, children }) {
  const { user, role: currentRole, loading, logout, needsProvisioning } = useAuth();
  const [resetDone, setResetDone] = useState(false);

  // Wrong role — destroy the foreign session, then send the visitor to the one
  // shared sign-in page (there are no per-portal login routes any more).
  useEffect(() => {
    if (!loading && user && currentRole !== role && !resetDone) {
      Promise.resolve(typeof logout === 'function' ? logout() : null).then(() => setResetDone(true), () => setResetDone(true));
    }
  }, [loading, user, currentRole, role, resetDone, logout]);

  // Unprovisioned: a session exists but no local profile row yet. Route to the
  // recovery page instead of /login — the session is kept alive there, and the
  // visitor can provision without signing up a new account.
  if (!loading && needsProvisioning) {
    return <Navigate to="/complete-registration" replace />;
  }

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (currentRole !== role) {
    if (!resetDone) return <LoadingScreen />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
