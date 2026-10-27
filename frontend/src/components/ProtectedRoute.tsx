import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './States';

export function ProtectedRoute() {
  const { user, loading, endingSession } = useAuth(); const location = useLocation();
  // Esperar la navegación al inicio al cerrar sesión, antes de redirigir al acceso.
  if (loading || (!user && endingSession)) return <Loading label="Comprobando tu sesión…"/>;
  return user ? <Outlet/> : <Navigate to={'/login?next=' + encodeURIComponent(location.pathname)} replace/>;
}
