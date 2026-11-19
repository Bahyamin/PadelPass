import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

// Page opened from the link of the verification email (FR-02):
// /verify-email?token=... activates the account and goes to the login page.
// If the link is invalid or expired, or without a token, the player can ask
// for a new link.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(Boolean(token));
  const sent = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development: send the token only once.
    if (!token || sent.current) return;
    sent.current = true;
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          navigate('/login', { replace: true, state: { info: data.message } });
        } else {
          setError(data.error.message);
          setChecking(false);
        }
      })
      .catch(() => {
        setError('Could not reach the server, try again later');
        setChecking(false);
      });
  }, [token, navigate]);

  if (checking) {
    return (
      <main>
        <h1>Email verification</h1>
        <p>Checking your link…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Email verification</h1>
      {error && <p role="alert">{error}</p>}
      <ResendForm />
    </main>
  );
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(res.ok ? data.message : data.error.message);
    } catch {
      setMessage('Could not reach the server, try again later');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Get a new verification link</h2>
      <p>
        <label>
          Email{' '}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
      </p>
      <button type="submit">Send a new link</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
