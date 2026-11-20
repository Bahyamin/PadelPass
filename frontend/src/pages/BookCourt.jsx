import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

const DURATIONS = [60, 90];

const toDay = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

// Sends a request to the API and returns [data, null] or [null, error message].
async function callApi(url, options) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return res.ok ? [data, null] : [null, data.error.message];
  } catch {
    return [null, 'Could not reach the server, try again later'];
  }
}

// Book a court page (FR-09, FR-10, UC-04): choose a court, a start time and a
// duration, see the price, then confirm. The grid of /book links here with the
// day, court and time already chosen.
export default function BookCourt() {
  const [params] = useSearchParams();
  const [date, setDate] = useState(params.get('date') ?? toDay(new Date()));
  const [courtId, setCourtId] = useState(params.get('courtId') ?? '');
  const [start, setStart] = useState(params.get('start') ?? '');
  const [duration, setDuration] = useState(60);
  const [grid, setGrid] = useState(null);
  const [summary, setSummary] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  // The grid of the day gives the courts and the start times to choose from.
  useEffect(() => {
    let cancelled = false;
    callApi(`/api/availability?date=${date}`).then(([data, message]) => {
      if (cancelled) return;
      setGrid(data);
      setError(message ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const court = grid?.courts.find((c) => String(c.id) === courtId);
  const freeTimes = court
    ? court.slots.filter((s) => s.status === 'FREE').map((s) => s.time)
    : [];

  // Any change of the slot hides the old price: it must be asked again.
  const change = (setter) => (event) => {
    setter(event.target.value);
    setSummary(null);
    setError('');
  };

  async function handleQuote(event) {
    event.preventDefault();
    const query = new URLSearchParams({ courtId, date, start, duration });
    const [data, message] = await callApi(`/api/pricing/quote?${query}`);
    setSummary(data);
    setError(message ?? '');
  }

  async function handleConfirm() {
    const [data, message] = await callApi('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courtId: Number(courtId),
        date,
        start,
        duration: Number(duration),
      }),
    });
    setBooking(data);
    setError(message ?? '');
  }

  if (booking) {
    return (
      <main>
        <h1>Booking confirmed</h1>
        <p role="status">
          {booking.courtName}, {dayLabel(booking.date)}, {booking.start} to{' '}
          {booking.end}: {booking.courtPrice} EUR, to pay at the club.
        </p>
        <p>
          <Link to="/book">Back to the availability</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Book a court</h1>
      <form onSubmit={handleQuote}>
        <p>
          <label>
            Day{' '}
            <input
              type="date"
              value={date}
              onChange={change(setDate)}
              required
            />
          </label>
        </p>
        <p>
          <label>
            Court{' '}
            <select value={courtId} onChange={change(setCourtId)} required>
              <option value="">Choose a court</option>
              {grid?.courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Start time{' '}
            <select value={start} onChange={change(setStart)} required>
              <option value="">Choose a time</option>
              {freeTimes.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </p>
        <fieldset>
          <legend>Duration</legend>
          {DURATIONS.map((minutes) => (
            <label key={minutes}>
              <input
                type="radio"
                name="duration"
                value={minutes}
                checked={Number(duration) === minutes}
                onChange={change(setDuration)}
              />{' '}
              {minutes} minutes{' '}
            </label>
          ))}
        </fieldset>
        <button type="submit">See the price</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {summary && (
        <section aria-label="Summary">
          <h2>Summary</h2>
          <p>
            {summary.courtName}, {dayLabel(summary.date)}, {summary.start} to{' '}
            {summary.end} ({summary.duration} minutes)
          </p>
          <p>
            Price: <strong>{summary.price} EUR</strong>
          </p>
          <button type="button" onClick={handleConfirm}>
            Confirm the booking
          </button>
        </section>
      )}
    </main>
  );
}
