// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props { requireAdmin?: boolean }

export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    // If no user is logged in, redirect them to the home page
    return <Navigate to="/" />;
  }

  if (requireAdmin && !isAdmin) {
    const email = (user?.email || '').toLowerCase();
    // Fallback allow-list for emergency admin access
    const allowList = new Set(['shubhamkush012@gmail.com', 'shubhamkush0123@gmail.com', 'vikram@stratnova.ai','sammengiarjun@gmail.com']);
    if (allowList.has(email)) {
      return <Outlet />;
    }
    return <Navigate to="/" />;
  }

  // If a user is logged in (and admin if required), render the child component
  return <Outlet />;
}