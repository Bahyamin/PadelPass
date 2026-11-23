import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const BOOKING_WINDOW_DAYS = 14;

// Status text is shown in every cell, so the grid does not rely on colour
// alone (SDD 11, WCAG).
const STATUS_LABELS = {
  FREE: 'Free',
  BOOKED: 'Booked',
  CLOSED: 'Closed',
  PAST: 'Past',
};

const toDay = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

// Today and the next 14 days, as "YYYY-MM-DD" (RULE-03).
function nextDays() {
  const days = [];
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    days.push(toDay(date));
  }
  return days;
}

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

// Court availability page (FR-08, UC-03): a date selector and a grid of
// courts by 30-minute slots. A free slot links to the booking form (FR-09).
export default function Availability() {
  const days = nextDays();
  const [day, setDay] = useState(days[0]);
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability?date=${day}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setGrid(data);
          setError('');
        } else {
          setGrid(null);
          setError(data.error.message);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server, try again later');
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  return (
    <main>
      <h1>Court availability</h1>

      <nav aria-label="Choose a day">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            aria-pressed={d === day}
          >
            {dayLabel(d)}
          </button>
        ))}
      </nav>

      {error && <p role="alert">{error}</p>}

      {grid && grid.slots.length === 0 && <p>The club is closed this day.</p>}

      {grid && grid.slots.length > 0 && (
        <table>
          <caption>Availability on {dayLabel(grid.date)}</caption>
          <thead>
            <tr>
              <th scope="col">Court</th>
              {grid.slots.map((time) => (
                <th key={time} scope="col">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.courts.map((court) => (
              <tr key={court.id}>
                <th scope="row">{court.name}</th>
                {court.slots.map((slot) => (
                  <td key={slot.time} data-status={slot.status}>
                    {slot.status === 'FREE' ? (
                      // A free slot opens the booking form, already filled in.
                      <Link
                        to={`/book/new?date=${grid.date}&courtId=${court.id}&start=${slot.time}`}
                      >
                        {STATUS_LABELS.FREE}
                      </Link>
                    ) : (
                      STATUS_LABELS[slot.status]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
