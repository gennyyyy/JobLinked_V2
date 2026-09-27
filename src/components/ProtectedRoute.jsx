import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import LoadingScreen from './LoadingScreen';

function ProtectedRoute({ role, children }) {
  const { user, role: currentRole, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={`/${role}/login`} replace />;
  if (currentRole !== role) return <Navigate to="/" replace />;

  return children;
}

export default ProtectedRoute;
