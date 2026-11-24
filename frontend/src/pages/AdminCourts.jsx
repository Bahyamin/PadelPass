import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const TYPE_LABELS = { INDOOR: 'Indoor', OUTDOOR: 'Outdoor' };

const EMPTY_COURT = { name: '', type: 'INDOOR' };
const EMPTY_CLOSURE = { courtId: '', start: '', end: '', reason: '' };

// "2026-11-30T08:00" -> "2026-11-30 08:00"
const showTime = (local) => local.replace('T', ' ');

// Sends a request to the API and returns [data, null] or [null, error message].
async function callApi(url, method = 'GET', body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return res.ok ? [data, null] : [null, data.error.message];
  } catch {
    return [null, 'Could not reach the server, try again later'];
  }
}

// Result of the last action of a section: a message or an error.
function Feedback({ message, error }) {
  if (error) return <p role="alert">{error}</p>;
  if (message) return <p role="status">{message}</p>;
  return null;
}

// What the administrator sees after closing a court: the cancelled bookings.
function ClosureResult({ closure, courtName }) {
  const cancelled = closure.cancelledBookings;
  return (
    <section aria-label="Closure saved">
      <p role="status">
        {courtName} closed from {showTime(closure.start)} to{' '}
        {showTime(closure.end)}.{' '}
        {cancelled.length === 0
          ? 'No booking was affected.'
          : `${cancelled.length} booking(s) cancelled, the players were notified by email.`}
      </p>
      {cancelled.length > 0 && (
        <ul>
          {cancelled.map((b) => (
            <li key={b.id}>
              {b.date} {b.start}-{b.end}: {b.player}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Courts and closures page (FR-24, UC-14), for administrators: add, edit,
// deactivate a court, and close one for a period. The API checks the role.
export default function AdminCourts() {
  const [courts, setCourts] = useState([]);
  const [form, setForm] = useState(EMPTY_COURT);
  const [editingId, setEditingId] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [closure, setClosure] = useState(EMPTY_CLOSURE);
  const [closureError, setClosureError] = useState('');
  const [closed, setClosed] = useState(null);

  async function reload() {
    const [data, error] = await callApi('/api/admin/courts');
    if (data) setCourts(data);
    if (error) setFeedback({ error });
  }

  useEffect(() => {
    callApi('/api/admin/courts').then(([data, error]) => {
      if (data) setCourts(data);
      if (error) setFeedback({ error });
    });
  }, []);

  function startEditing(court) {
    setEditingId(court.id);
    setForm({ name: court.name, type: court.type });
    setFeedback({});
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_COURT);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const [, error] = editingId
      ? await callApi(`/api/admin/courts/${editingId}`, 'PATCH', form)
      : await callApi('/api/admin/courts', 'POST', form);
    if (error) return setFeedback({ error });
    setFeedback({ message: editingId ? 'Court updated' : 'Court added' });
    cancelEditing();
    await reload();
  }

  async function setActive(court, isActive) {
    const [, error] = await callApi(`/api/admin/courts/${court.id}`, 'PATCH', {
      isActive,
    });
    if (error) return setFeedback({ error });
    setFeedback({
      message: `${court.name} ${isActive ? 'reactivated' : 'deactivated'}`,
    });
    await reload();
  }

  async function handleClose(event) {
    event.preventDefault();
    setClosed(null);
    const [data, error] = await callApi(
      `/api/admin/courts/${closure.courtId}/closures`,
      'POST',
      { start: closure.start, end: closure.end, reason: closure.reason },
    );
    setClosureError(error ?? '');
    if (!data) return;
    setClosed(data);
    setClosure(EMPTY_CLOSURE);
    await reload();
  }

  const closureField = (name) => ({
    value: closure[name],
    onChange: (e) => setClosure({ ...closure, [name]: e.target.value }),
  });

  return (
    <main>
      <h1>Courts and closures</h1>
      <p>
        <Link to="/book">See the availability grid</Link>
      </p>

      <section aria-labelledby="courts-title">
        <h2 id="courts-title">Courts</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Closures to come</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {courts.map((court) => (
              <tr key={court.id}>
                <td>{court.name}</td>
                <td>{TYPE_LABELS[court.type]}</td>
                <td>{court.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  {court.closures.length === 0
                    ? 'None'
                    : court.closures.map((c) => (
                        <div key={c.id}>
                          {showTime(c.start)} to {showTime(c.end)}: {c.reason}
                        </div>
                      ))}
                </td>
                <td>
                  <button type="button" onClick={() => startEditing(court)}>
                    Edit {court.name}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => setActive(court, !court.isActive)}
                  >
                    {court.isActive ? 'Deactivate' : 'Reactivate'} {court.name}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={handleSubmit} aria-label="Court">
          <h3>{editingId ? 'Edit the court' : 'Add a court'}</h3>
          <label>
            Name{' '}
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>{' '}
          <label>
            Type{' '}
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="INDOOR">Indoor</option>
              <option value="OUTDOOR">Outdoor</option>
            </select>
          </label>{' '}
          <button type="submit">
            {editingId ? 'Save the court' : 'Add the court'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEditing}>
              Cancel
            </button>
          )}
        </form>
        <Feedback {...feedback} />
      </section>

      <section aria-labelledby="closure-title">
        <h2 id="closure-title">Close a court</h2>
        <p>
          The confirmed bookings during the closure are cancelled and their
          players are notified by email.
        </p>
        <form onSubmit={handleClose} aria-label="Closure">
          <p>
            <label>
              Court{' '}
              <select required {...closureField('courtId')}>
                <option value="">Choose a court</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              From{' '}
              <input
                type="datetime-local"
                required
                {...closureField('start')}
              />
            </label>{' '}
            <label>
              To{' '}
              <input type="datetime-local" required {...closureField('end')} />
            </label>
          </p>
          <p>
            <label>
              Reason <input type="text" required {...closureField('reason')} />
            </label>
          </p>
          <button type="submit">Close the court</button>
        </form>
        {closureError && <p role="alert">{closureError}</p>}
        {closed && (
          <ClosureResult
            closure={closed}
            courtName={
              courts.find((c) => c.id === closed.courtId)?.name ?? 'The court'
            }
          />
        )}
      </section>
    </main>
  );
}
