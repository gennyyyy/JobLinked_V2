import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

function ProtectedRoute({ role, children }) {
  const { user, role: currentRole, loading, logout } = useAuth();
  const [resetDone, setResetDone] = useState(false);

  // ADR-021 rule 3: wrong role — destroy the foreign session, then redirect
  // to the attempted portal's login (renders as guest per rule 2).
  useEffect(() => {
    if (!loading && user && currentRole !== role && !resetDone) {
      Promise.resolve(typeof logout === 'function' ? logout() : null).then(() => setResetDone(true), () => setResetDone(true));
    }
  }, [loading, user, currentRole, role, resetDone, logout]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={`/${role}/login`} replace />;
  if (currentRole !== role) {
    if (!resetDone) return <LoadingScreen />;
    return <Navigate to={`/${role}/login`} replace />;
  }

  return children;
}

export default ProtectedRoute;
