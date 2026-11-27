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

const toCents = (price) => Math.round(Number(price) * 100);
const euros = (cents) => (cents / 100).toFixed(2);

// Price of the chosen equipment, in cents: quantity x rental price.
const equipmentCents = (catalogue, quantities) =>
  catalogue.reduce(
    (sum, type) => sum + (quantities[type.id] ?? 0) * toCents(type.rentalPrice),
    0,
  );

// Sends a request to the API and returns [data, null] or
// [null, error message, error code].
async function callApi(url, options) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return res.ok ? [data, null] : [null, data.error.message, data.error.code];
  } catch {
    return [null, 'Could not reach the server, try again later'];
  }
}

// Book a court page (FR-09, FR-10, UC-04): choose a court, a start time and a
// duration, see the price, add rackets and balls if needed (FR-18, UC-05:
// the total price follows), then confirm. The grid of /book links here with
// the day, court and time already chosen.
export default function BookCourt() {
  const [params] = useSearchParams();
  const [date, setDate] = useState(params.get('date') ?? toDay(new Date()));
  const [courtId, setCourtId] = useState(params.get('courtId') ?? '');
  const [start, setStart] = useState(params.get('start') ?? '');
  const [duration, setDuration] = useState(60);
  const [grid, setGrid] = useState(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [summary, setSummary] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  // FR-17, FR-18: the equipment of the slot and the quantities chosen.
  const [catalogue, setCatalogue] = useState([]);
  const [quantities, setQuantities] = useState({});

  // The grid of the day gives the courts and the start times to choose from.
  // It is loaded again when gridVersion changes (slot taken in the meantime).
  useEffect(() => {
    let cancelled = false;
    callApi(`/api/availability?date=${date}`).then(([data, message]) => {
      if (cancelled) return;
      setGrid(data);
      if (message) setError(message);
    });
    return () => {
      cancelled = true;
    };
  }, [date, gridVersion]);

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

  // The equipment available for the slot. Without it (error), the court can
  // still be booked: the equipment part is simply not shown.
  async function loadEquipment() {
    const query = new URLSearchParams({ date, start, duration });
    const [data] = await callApi(`/api/equipment/availability?${query}`);
    setCatalogue(data?.equipment ?? []);
  }

  async function handleQuote(event) {
    event.preventDefault();
    const query = new URLSearchParams({ courtId, date, start, duration });
    const [data, message] = await callApi(`/api/pricing/quote?${query}`);
    setSummary(data);
    setError(message ?? '');
    setQuantities({});
    if (data) await loadEquipment();
  }

  const setQuantity = (typeId) => (event) => {
    setQuantities({ ...quantities, [typeId]: Number(event.target.value) });
    setError('');
  };

  async function handleConfirm() {
    const equipment = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([typeId, quantity]) => ({ typeId: Number(typeId), quantity }));
    const [data, message, code] = await callApi('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courtId: Number(courtId),
        date,
        start,
        duration: Number(duration),
        ...(equipment.length > 0 && { equipment }),
      }),
    });
    setBooking(data);
    setError(message ?? '');
    // FR-19: the stock changed in the meantime: show the new quantities.
    if (code === 'EQUIPMENT_UNAVAILABLE') await loadEquipment();
    // FR-11: somebody booked this slot in the meantime. The summary is hidden
    // and the grid is loaded again, so the taken time leaves the list.
    if (code === 'SLOT_UNAVAILABLE') {
      setSummary(null);
      setStart('');
      setGridVersion((version) => version + 1);
    }
  }

  if (booking) {
    return (
      <main>
        <h1>Booking confirmed</h1>
        <p role="status">
          {booking.courtName}, {dayLabel(booking.date)}, {booking.start} to{' '}
          {booking.end}: {booking.totalPrice} EUR, to pay at the club.
        </p>
        {booking.equipment.length > 0 && (
          <p>
            Equipment:{' '}
            {booking.equipment
              .map((e) => `${e.quantity} × ${e.name}`)
              .join(', ')}
          </p>
        )}
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
          {catalogue.length > 0 && (
            <fieldset>
              <legend>Equipment (optional)</legend>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Equipment</th>
                    <th scope="col">Price</th>
                    <th scope="col">Available</th>
                    <th scope="col">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogue.map((type) => (
                    <tr key={type.id}>
                      <td>{type.name}</td>
                      <td>{type.rentalPrice} EUR</td>
                      <td>{type.available}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={type.available}
                          aria-label={`${type.name} quantity`}
                          value={quantities[type.id] ?? 0}
                          onChange={setQuantity(type.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
          )}
          <p>Court: {summary.price} EUR</p>
          <p>Equipment: {euros(equipmentCents(catalogue, quantities))} EUR</p>
          <p>
            Total price:{' '}
            <strong>
              {euros(
                toCents(summary.price) + equipmentCents(catalogue, quantities),
              )}{' '}
              EUR
            </strong>
          </p>
          <button type="button" onClick={handleConfirm}>
            Confirm the booking
          </button>
        </section>
      )}
    </main>
  );
}
