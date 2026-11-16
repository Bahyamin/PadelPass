import { useState } from 'react';
import { Link } from 'react-router';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  acceptedTerms: false,
};

// Registration page (FR-01). The API checks every rule and sends back a
// readable message, so the rules live in one place: the backend.
export default function Register() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);

  function handleChange(event) {
    const { name, type, checked, value } = event.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setCreated(true);
      } else {
        const data = await res.json();
        setError(data.error.message);
      }
    } catch {
      setError('Could not reach the server, try again later');
    }
  }

  if (created) {
    return (
      <main>
        <h1>Create an account</h1>
        <p role="status">Account created, check your email to verify it</p>
        <p>
          <Link to="/login">Go to the login page</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create an account</h1>
      <form onSubmit={handleSubmit}>
        <p>
          <label>
            First name{' '}
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              autoComplete="given-name"
              required
            />
          </label>
        </p>
        <p>
          <label>
            Last name{' '}
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              required
            />
          </label>
        </p>
        <p>
          <label>
            Email{' '}
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
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
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </label>{' '}
          <small>At least 8 characters, with a letter and a digit</small>
        </p>
        <p>
          <label>
            Phone{' '}
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              required
            />
          </label>
        </p>
        <p>
          <label>
            <input
              name="acceptedTerms"
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={handleChange}
              required
            />{' '}
            I accept the terms and the privacy policy
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Create my account</button>
      </form>
    </main>
  );
}
