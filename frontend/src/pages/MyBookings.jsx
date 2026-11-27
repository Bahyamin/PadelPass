import { useEffect, useState } from 'react';
import { Link } from 'react-router';

const STATUS_LABELS = {
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const PAYMENT_LABELS = {
  UNPAID: 'To pay at the club',
  PAID: 'Paid',
};

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const equipmentLabel = (equipment) =>
  equipment.length
    ? equipment.map((e) => `${e.quantity} × ${e.name}`).join(', ')
    : 'None';

// One list of bookings (upcoming or past), as a table. With canChange, a
// confirmed booking gets a link to change its equipment (FR-18).
function BookingTable({ title, bookings, empty, canChange = false }) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {bookings.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Time</th>
              <th scope="col">Court</th>
              <th scope="col">Duration</th>
              <th scope="col">Equipment</th>
              <th scope="col">Total price</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              {canChange && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{dayLabel(b.date)}</td>
                <td>
                  {b.start} - {b.end}
                </td>
                <td>{b.courtName}</td>
                <td>{b.duration} min</td>
                <td>{equipmentLabel(b.equipment)}</td>
                <td>{b.totalPrice} EUR</td>
                <td>{STATUS_LABELS[b.status] ?? b.status}</td>
                <td>{PAYMENT_LABELS[b.paymentStatus] ?? b.paymentStatus}</td>
                {canChange && (
                  <td>
                    {b.status === 'CONFIRMED' && (
                      <Link to={`/my-bookings/${b.id}/equipment`}>
                        Change equipment
                      </Link>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// My bookings page (FR-14, UC-07): the upcoming bookings first, then the
// past ones. The API only returns the bookings of the logged-in player.
export default function MyBookings() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bookings/me')
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setBookings(data);
        else setError(data.error.message);
      })
      .catch(() => setError('Could not reach the server, try again later'));
  }, []);

  return (
    <main>
      <h1>My bookings</h1>
      {error && <p role="alert">{error}</p>}
      {!bookings && !error && <p>Loading…</p>}
      {bookings && (
        <>
          <BookingTable
            title="Upcoming bookings"
            bookings={bookings.upcoming}
            empty="No upcoming booking."
            canChange
          />
          <BookingTable
            title="Past bookings"
            bookings={bookings.past}
            empty="No past booking."
          />
        </>
      )}
      <p>
        <Link to="/book">Book a court</Link>
      </p>
    </main>
  );
}
