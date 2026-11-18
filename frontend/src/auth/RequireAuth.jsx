import { Navigate } from 'react-router';
import { useAuth } from './AuthContext.jsx';

// Route guard (SDD 5.2): a page wrapped in <RequireAuth> is only shown to a
// logged-in user; anybody else is sent to the login page. The API checks the
// token again on every request, so this guard is only for the display.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
