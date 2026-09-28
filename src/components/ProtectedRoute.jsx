import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

function ProtectedRoute({ role, children }) {
  const { user, role: currentRole, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={`/${role}/login`} replace />;
  // Wrong role — send them to their own portal's home, not the landing page
  if (currentRole !== role) return <Navigate to={`/${currentRole}`} replace />;

  return children;
}

export default ProtectedRoute;
