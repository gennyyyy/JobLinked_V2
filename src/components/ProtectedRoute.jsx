import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function ProtectedRoute({ role, children }) {
  const { role: currentRole } = useAuth();

  if (!currentRole) {
    return <Navigate to={`/${role}/login`} replace />;
  }

  if (currentRole !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
