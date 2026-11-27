import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

const STATUS_LABELS = {
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const PAYMENT_LABELS = { UNPAID: 'Unpaid', PAID: 'Paid' };

const CONDITION_LABELS = { OK: 'OK', DAMAGED: 'Damaged', MISSING: 'Missing' };

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// "2026-11-25T17:55" -> "2026-11-25 17:55"
const showTime = (local) => (local ? local.replace('T', ' ') : '');

// Details of a booking for the front desk (FR-27, AC-16), opened from the
// daily planning: the slot, the player or guest, the prices and payment, the
// reserved equipment and the items handed out. The actions on the booking
// (pick-up, return, payment...) are added to their section by their stories.
export default function BookingDetails() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setBooking(data);
        else setError(data.error.message);
      })
      .catch(() => setError('Could not reach the server, try again later'));
  }, [id]);

  if (!booking) {
    return (
      <main>
        <h1>Booking details</h1>
        {error ? <p role="alert">{error}</p> : <p>Loading…</p>}
        <p>
          <Link to="/staff/planning">Back to the planning</Link>
        </p>
      </main>
    );
  }

  const { player, guest } = booking;

  return (
    <main>
      <h1>Booking details</h1>

      <section aria-label="Booking">
        <h2>Booking</h2>
        <p>
          {`${booking.courtName}, ${dayLabel(booking.date)}, ` +
            `${booking.start} to ${booking.end} (${booking.duration} minutes)`}
        </p>
        <p>Status: {STATUS_LABELS[booking.status] ?? booking.status}</p>
        {player ? (
          <p>
            Player: {player.firstName} {player.lastName}, {player.email},{' '}
            {player.phone}
          </p>
        ) : (
          <p>
            Guest: {guest.name}, {guest.phone}
          </p>
        )}
        <p>
          Price: court {booking.courtPrice} EUR, equipment{' '}
          {booking.equipmentPrice} EUR, fees {booking.feesTotal} EUR, total{' '}
          <strong>{booking.totalPrice} EUR</strong>
        </p>
        <p>
          Payment:{' '}
          {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus}
        </p>
      </section>

      <section aria-label="Equipment">
        <h2>Equipment</h2>
        <p>
          Reserved:{' '}
          {booking.equipment.length
            ? booking.equipment
                .map((e) => `${e.quantity} × ${e.name}`)
                .join(', ')
            : 'none'}
        </p>
        <h3>Items handed out</h3>
        {booking.rentals.length === 0 ? (
          <p>No item handed out yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Type</th>
                <th scope="col">Picked up</th>
                <th scope="col">Returned</th>
                <th scope="col">Condition</th>
              </tr>
            </thead>
            <tbody>
              {booking.rentals.map((rental) => (
                <tr key={rental.id}>
                  <td>{rental.code}</td>
                  <td>{rental.typeName}</td>
                  <td>{showTime(rental.pickedUpAt)}</td>
                  <td>{showTime(rental.returnedAt)}</td>
                  <td>{CONDITION_LABELS[rental.returnCondition] ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p>
        <Link to={`/staff/planning?date=${booking.date}`}>
          Back to the planning
        </Link>
      </p>
    </main>
  );
}
