import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

// The fields the player can change (FR-05). The email is shown, not editable.
const FIELDS = [
  { name: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last name', autoComplete: 'family-name' },
  { name: 'phone', label: 'Phone', autoComplete: 'tel', type: 'tel' },
];

const formOf = (user) => ({
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  phone: user.phone ?? '',
});

// My profile page (FR-05), only reachable when logged in (RequireAuth in
// App.jsx). The API checks every value, with the same rules as the
// registration, and names the wrong field: its message is shown next to it.
export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => formOf(user));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  // The user of the login has no phone: ask the API for the whole profile.
  useEffect(() => {
    fetch('/api/users/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => profile && setForm(formOf(profile)))
      .catch(() => {});
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: undefined });
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setMessage('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setForm(formOf(data));
        setUser(data); // the home page greets the new first name
        setMessage('Profile saved');
      } else {
        const { field, message: error } = data.error;
        setErrors(field ? { [field]: error } : { form: error });
      }
    } catch {
      setErrors({ form: 'Could not reach the server, try again later' });
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <main>
      <h1>My profile</h1>
      <form onSubmit={handleSubmit} noValidate>
        {FIELDS.map(({ name, label, autoComplete, type = 'text' }) => (
          <p key={name}>
            <label>
              {label}{' '}
              <input
                name={name}
                type={type}
                value={form[name]}
                onChange={handleChange}
                autoComplete={autoComplete}
                aria-invalid={errors[name] ? true : undefined}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
              />
            </label>{' '}
            {errors[name] && (
              <span id={`${name}-error`} role="alert">
                {errors[name]}
              </span>
            )}
          </p>
        ))}
        <p>
          Email: <span>{user.email}</span>{' '}
          <small>(the email cannot be changed)</small>
        </p>
        {errors.form && <p role="alert">{errors.form}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit">Save my profile</button>
      </form>
      <p>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </p>
    </main>
  );
}
