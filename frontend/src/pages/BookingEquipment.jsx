import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

const toCents = (price) => Math.round(Number(price) * 100);
const euros = (cents) => (cents / 100).toFixed(2);

// The quantity of each type reserved by the booking: { [typeId]: quantity }.
const quantitiesOf = (result) =>
  Object.fromEntries(result.equipment.map((t) => [t.typeId, t.quantity]));

// "2026-11-25T16:00" -> "2026-11-25 16:00"
const showTime = (local) => local.replace('T', ' ');

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

// Change the equipment of a booking (FR-18, FR-19, UC-05), until 2 hours
// before its start. The total price follows the quantities; the API checks
// the stock of the slot and the deadline again when saving.
export default function BookingEquipment() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [result, loadError] = await callApi(`/api/bookings/${id}/equipment`);
    setData(result);
    if (loadError) setError(loadError);
    if (result) setQuantities(quantitiesOf(result));
  }

  useEffect(() => {
    callApi(`/api/bookings/${id}/equipment`).then(([result, loadError]) => {
      setData(result);
      if (loadError) setError(loadError);
      if (result) setQuantities(quantitiesOf(result));
    });
  }, [id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    const equipment = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([typeId, quantity]) => ({ typeId: Number(typeId), quantity }));
    const [saved, saveError] = await callApi(`/api/bookings/${id}/equipment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment }),
    });
    setError(saveError ?? '');
    if (!saved) return;
    await load();
    setMessage(`Equipment saved. New total price: ${saved.totalPrice} EUR`);
  }

  if (!data) {
    return (
      <main>
        <h1>Equipment of my booking</h1>
        {error ? <p role="alert">{error}</p> : <p>Loading…</p>}
        <p>
          <Link to="/my-bookings">Back to my bookings</Link>
        </p>
      </main>
    );
  }

  const { booking } = data;
  const equipmentCents = data.equipment.reduce(
    (sum, type) =>
      sum + (quantities[type.typeId] ?? 0) * toCents(type.unitPrice),
    0,
  );
  const totalCents =
    toCents(booking.courtPrice) + equipmentCents + toCents(booking.feesTotal);

  return (
    <main>
      <h1>Equipment of my booking</h1>
      <p>
        {booking.courtName}, {booking.date}, {booking.start} to {booking.end}
      </p>
      <p>
        {data.canChange
          ? `You can change the equipment until ${showTime(data.changeDeadline)}.`
          : `The equipment could be changed until ${showTime(data.changeDeadline)}.`}
      </p>
      {/* noValidate: the API checks the stock and gives its own message. */}
      <form onSubmit={handleSubmit} noValidate>
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
            {data.equipment.map((type) => (
              <tr key={type.typeId}>
                <td>{type.name}</td>
                <td>{type.unitPrice} EUR</td>
                <td>{type.available}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max={type.available}
                    aria-label={`${type.name} quantity`}
                    value={quantities[type.typeId] ?? 0}
                    disabled={!data.canChange}
                    onChange={(e) => {
                      setQuantities({
                        ...quantities,
                        [type.typeId]: Number(e.target.value),
                      });
                      setMessage('');
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Court: {booking.courtPrice} EUR</p>
        <p>Equipment: {euros(equipmentCents)} EUR</p>
        <p>
          Total price: <strong>{euros(totalCents)} EUR</strong>
        </p>
        {data.canChange && <button type="submit">Save the equipment</button>}
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <p>
        <Link to="/my-bookings">Back to my bookings</Link>
      </p>
    </main>
  );
}
