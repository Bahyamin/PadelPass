import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Home() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState('...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main>
      <h1>PadelPassTeam</h1>
      <p>
        API status: <span>{health}</span>
      </p>
      {user ? (
        <>
          <p>Hello {user.firstName}</p>
          <p>
            <Link to="/profile">My profile</Link>{' '}
            <button type="button" onClick={logout}>
              Log out
            </button>
          </p>
        </>
      ) : (
        <p>
          <Link to="/login">Log in</Link> or{' '}
          <Link to="/register">Create an account</Link>
        </p>
      )}
      <p>
        <Link to="/book">Book a court</Link>
      </p>
      <p>
        <Link to="/equipment">Equipment for rent</Link>
      </p>
    </main>
  );
}
