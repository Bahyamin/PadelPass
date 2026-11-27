import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

const SLOT_MINUTES = 30;

const PAYMENT_LABELS = { UNPAID: 'Unpaid', PAID: 'Paid' };
const STATUS_LABELS = { COMPLETED: 'Completed', NO_SHOW: 'No-show' };

const toDay = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const addDays = (day, count) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + count);
  return toDay(date);
};

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// "18:00" + 30 -> "18:30"
const addMinutes = (time, minutes) => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const equipmentLabel = (equipment) =>
  equipment.length
    ? equipment.map((e) => `${e.quantity} × ${e.name}`).join(', ')
    : 'No equipment';

// The cells of one court on the timeline: a booking covers as many
// 30-minute columns as it lasts; a column of a closure says "Closed".
function timelineCells(slots, court) {
  const cells = [];
  for (let i = 0; i < slots.length;) {
    const time = slots[i];
    const booking = court.bookings.find((b) => b.start === time);
    if (booking) {
      const span = Math.min(
        Math.max(1, Math.ceil(booking.duration / SLOT_MINUTES)),
        slots.length - i,
      );
      cells.push({ time, booking, span });
      i += span;
    } else {
      const end = addMinutes(time, SLOT_MINUTES);
      const closed = court.closures.some((c) => c.start < end && c.end > time);
      cells.push({ time, closed });
      i += 1;
    }
  }
  return cells;
}

// One booking on the timeline (FR-27, AC-16): time, player or guest, reserved
// equipment and payment status. It opens the details of the booking.
function BookingCell({ booking }) {
  const who = booking.isGuest ? `Guest: ${booking.player}` : booking.player;
  return (
    <>
      <Link to={`/staff/bookings/${booking.id}`}>
        {booking.start}-{booking.end} {who}
      </Link>{' '}
      ({equipmentLabel(booking.equipment)};{' '}
      {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus}
      {STATUS_LABELS[booking.status] && `; ${STATUS_LABELS[booking.status]}`})
    </>
  );
}

// Daily planning of the front desk (FR-27, UC-09): for a chosen day, each
// court and its bookings on a timeline of 30-minute columns. The day is in
// the address (?date=...), so the details page can link back to it.
export default function Planning() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? toDay(new Date());
  const [planning, setPlanning] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/staff/planning?date=${date}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        setPlanning(res.ok ? data : null);
        setError(res.ok ? '' : data.error.message);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server, try again later');
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const showDay = (day) => day && setParams({ date: day });

  return (
    <main>
      <h1>Daily planning</h1>
      <nav aria-label="Choose a day">
        <button type="button" onClick={() => showDay(addDays(date, -1))}>
          Previous day
        </button>{' '}
        <label>
          Day{' '}
          <input
            type="date"
            value={date}
            onChange={(e) => showDay(e.target.value)}
          />
        </label>{' '}
        <button type="button" onClick={() => showDay(addDays(date, 1))}>
          Next day
        </button>{' '}
        <button type="button" onClick={() => showDay(toDay(new Date()))}>
          Today
        </button>
      </nav>

      {error && <p role="alert">{error}</p>}

      {planning && planning.slots.length === 0 && (
        <p>The club is closed this day and has no booking.</p>
      )}

      {planning && planning.slots.length > 0 && (
        <table>
          <caption>{`Planning of ${dayLabel(planning.date)}`}</caption>
          <thead>
            <tr>
              <th scope="col">Court</th>
              {planning.slots.map((time) => (
                <th key={time} scope="col">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planning.courts.map((court) => (
              <tr key={court.id}>
                <th scope="row">
                  {court.name}
                  {!court.isActive && ' (inactive)'}
                </th>
                {timelineCells(planning.slots, court).map((cell) =>
                  cell.booking ? (
                    <td key={cell.time} colSpan={cell.span}>
                      <BookingCell booking={cell.booking} />
                    </td>
                  ) : (
                    <td key={cell.time}>{cell.closed ? 'Closed' : ''}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <Link to="/">Home</Link>
      </p>
    </main>
  );
}
