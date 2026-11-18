import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

// Protected page (only reachable when logged in, see RequireAuth in App.jsx).
// For now it shows who is logged in; editing the profile comes later (FR-05).
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <main>
      <h1>My profile</h1>
      <p>
        {user.firstName} {user.lastName}
      </p>
      <p>{user.email}</p>
      <button type="button" onClick={handleLogout}>
        Log out
      </button>
    </main>
  );
}
