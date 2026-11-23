import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
// Days shown from Monday to Sunday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const SETTING_LABELS = {
  maxActiveBookings: 'Maximum active bookings per player',
  bookingWindowDays: 'Booking window (days ahead)',
  cancellationDeadlineHours: 'Cancellation deadline (hours before the start)',
  equipmentChangeDeadlineHours:
    'Equipment change deadline (hours before the start)',
};

const EMPTY_RULE = {
  dayOfWeek: '1',
  startTime: '',
  endTime: '',
  pricePerHour: '',
  label: '',
};

// Sends a request to the API and returns [data, null] or [null, error message].
async function callApi(url, method = 'GET', body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return [null, null];
    const data = await res.json();
    return res.ok ? [data, null] : [null, data.error.message];
  } catch {
    return [null, 'Could not reach the server, try again later'];
  }
}

// Result of the last save of a section: a message or an error.
function Feedback({ message, error }) {
  if (error) return <p role="alert">{error}</p>;
  if (message) return <p role="status">{message}</p>;
  return null;
}

function OpeningHours() {
  const [days, setDays] = useState(null);
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    callApi('/api/admin/opening-hours').then(([data, error]) => {
      setDays(data);
      setFeedback({ error });
    });
  }, []);

  const update = (dayOfWeek, field, value) =>
    setDays(
      days.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d,
      ),
    );

  async function handleSubmit(event) {
    event.preventDefault();
    const [data, error] = await callApi(
      '/api/admin/opening-hours',
      'PUT',
      days,
    );
    if (data) setDays(data);
    setFeedback(error ? { error } : { message: 'Opening hours saved' });
  }

  return (
    <section aria-labelledby="hours-title">
      <h2 id="hours-title">Opening hours</h2>
      {days && (
        <form onSubmit={handleSubmit}>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Closed</th>
                <th scope="col">Opens</th>
                <th scope="col">Closes</th>
              </tr>
            </thead>
            <tbody>
              {WEEK_ORDER.map((dayOfWeek) => {
                const day = days.find((d) => d.dayOfWeek === dayOfWeek);
                const name = DAY_NAMES[dayOfWeek];
                return (
                  <tr key={dayOfWeek}>
                    <th scope="row">{name}</th>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${name} closed`}
                        checked={day.closed}
                        onChange={(e) =>
                          update(dayOfWeek, 'closed', e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        step="1800"
                        aria-label={`${name} opens`}
                        value={day.openTime ?? ''}
                        disabled={day.closed}
                        onChange={(e) =>
                          update(dayOfWeek, 'openTime', e.target.value)
                        }
                        required={!day.closed}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        step="1800"
                        aria-label={`${name} closes`}
                        value={day.closeTime ?? ''}
                        disabled={day.closed}
                        onChange={(e) =>
                          update(dayOfWeek, 'closeTime', e.target.value)
                        }
                        required={!day.closed}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="submit">Save the opening hours</button>
        </form>
      )}
      <Feedback {...feedback} />
    </section>
  );
}

function PricingRules() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(EMPTY_RULE);
  const [editingId, setEditingId] = useState(null);
  const [feedback, setFeedback] = useState({});

  async function reload() {
    const [data, error] = await callApi('/api/admin/pricing-rules');
    if (data) setRules(data);
    if (error) setFeedback({ error });
  }

  useEffect(() => {
    callApi('/api/admin/pricing-rules').then(([data, error]) => {
      if (data) setRules(data);
      if (error) setFeedback({ error });
    });
  }, []);

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });

  function startEditing(rule) {
    setEditingId(rule.id);
    setForm({ ...rule, dayOfWeek: String(rule.dayOfWeek) });
    setFeedback({});
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_RULE);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const body = {
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      pricePerHour: Number(form.pricePerHour),
      label: form.label,
    };
    const [, error] = editingId
      ? await callApi(`/api/admin/pricing-rules/${editingId}`, 'PATCH', body)
      : await callApi('/api/admin/pricing-rules', 'POST', body);
    if (error) return setFeedback({ error });
    setFeedback({ message: editingId ? 'Rule updated' : 'Rule added' });
    cancelEditing();
    await reload();
  }

  async function handleDelete(rule) {
    const [, error] = await callApi(
      `/api/admin/pricing-rules/${rule.id}`,
      'DELETE',
    );
    setFeedback(error ? { error } : { message: 'Rule deleted' });
    if (!error) await reload();
  }

  return (
    <section aria-labelledby="rules-title">
      <h2 id="rules-title">Pricing rules</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">Price per hour</th>
            <th scope="col">Label</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{DAY_NAMES[rule.dayOfWeek]}</td>
              <td>{rule.startTime}</td>
              <td>{rule.endTime}</td>
              <td>{rule.pricePerHour} EUR</td>
              <td>{rule.label}</td>
              <td>
                <button type="button" onClick={() => startEditing(rule)}>
                  Edit
                </button>{' '}
                <button type="button" onClick={() => handleDelete(rule)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleSubmit} aria-label="Pricing rule">
        <h3>{editingId ? 'Edit the rule' : 'Add a rule'}</h3>
        <label>
          Day{' '}
          <select {...field('dayOfWeek')}>
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_NAMES[d]}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          From{' '}
          <input type="time" step="1800" required {...field('startTime')} />
        </label>{' '}
        <label>
          To <input type="time" step="1800" required {...field('endTime')} />
        </label>{' '}
        <label>
          Price per hour (EUR){' '}
          <input
            type="number"
            min="0"
            step="0.01"
            required
            {...field('pricePerHour')}
          />
        </label>{' '}
        <label>
          Label <input type="text" required {...field('label')} />
        </label>{' '}
        <button type="submit">
          {editingId ? 'Save the rule' : 'Add the rule'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEditing}>
            Cancel
          </button>
        )}
      </form>
      <Feedback {...feedback} />
    </section>
  );
}

function BookingSettings() {
  const [settings, setSettings] = useState(null);
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    callApi('/api/admin/settings').then(([data, error]) => {
      setSettings(data);
      setFeedback({ error });
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const body = Object.fromEntries(
      Object.entries(settings).map(([name, value]) => [name, Number(value)]),
    );
    const [data, error] = await callApi('/api/admin/settings', 'PUT', body);
    if (data) setSettings(data);
    setFeedback(error ? { error } : { message: 'Booking parameters saved' });
  }

  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title">Booking parameters</h2>
      {settings && (
        <form onSubmit={handleSubmit}>
          {Object.entries(SETTING_LABELS).map(([name, label]) => (
            <p key={name}>
              <label>
                {label}{' '}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={settings[name]}
                  onChange={(e) =>
                    setSettings({ ...settings, [name]: e.target.value })
                  }
                />
              </label>
            </p>
          ))}
          <button type="submit">Save the parameters</button>
        </form>
      )}
      <Feedback {...feedback} />
    </section>
  );
}

// Club settings page (FR-25, UC-15), for administrators: opening hours,
// pricing rules and booking parameters. The API checks the role again.
export default function AdminSettings() {
  const { user } = useAuth();

  if (user.role !== 'ADMIN') {
    return (
      <main>
        <h1>Club settings</h1>
        <p role="alert">This page is for administrators only.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Club settings</h1>
      <p>Existing bookings keep the price they were booked at.</p>
      <OpeningHours />
      <PricingRules />
      <BookingSettings />
    </main>
  );
}
