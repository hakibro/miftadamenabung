import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { canAccess, roleHome } from '../utils/roles';

export default function ProtectedRoute({ roles }) {
  const { profile, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canAccess(profile, roles)) {
    return <Navigate to={roleHome(profile?.role)} replace />;
  }

  return <Outlet />;
}
