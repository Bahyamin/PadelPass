import { Navigate } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import { hasRole } from './roles.js';

// Route guard (SDD 5.2): a page wrapped in <RequireAuth> is only shown to a
// logged-in user; anybody else is sent to the login page.
// With roles (e.g. <RequireAuth roles={ADMIN}>), a logged-in user without one
// of these roles is sent to the home page (FR-07, AC-03).
// The API checks the token and the role again on every request, so this guard
// is only for the display.
export default function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(user, roles)) return <Navigate to="/" replace />;
  return children;
}
