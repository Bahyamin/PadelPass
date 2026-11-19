import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

// Login page (FR-03). Errors come from the API: a generic message for wrong
// credentials, and an explicit one when the email is locked or not verified.
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  // Message passed by another page, e.g. after the email verification.
  const info = useLocation().state?.info;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      const message = await login(email, password);
      if (message) setError(message);
      else navigate('/');
    } catch {
      setError('Could not reach the server, try again later');
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      {info && <p role="status">{info}</p>}
      <form onSubmit={handleSubmit}>
        <p>
          <label>
            Email{' '}
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        </p>
        <p>
          <label>
            Password{' '}
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Log in</button>
      </form>
      <p>
        No account yet? <Link to="/register">Create an account</Link>
      </p>
      <p>
        Did not receive the verification email?{' '}
        <Link to="/verify-email">Get a new link</Link>
      </p>
    </main>
  );
}
