import { useEffect, useState } from 'react';

const DURATIONS = [60, 90];

const toDay = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

// Sends a GET request to the API and returns [data, null] or [null, error message].
async function getJson(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return res.ok ? [data, null] : [null, data.error.message];
  } catch {
    return [null, 'Could not reach the server, try again later'];
  }
}

// Equipment for rent page (FR-17, RULE-08): for a chosen slot, every
// equipment type with its price and the quantity still available.
export default function RentEquipment() {
  const [date, setDate] = useState(toDay(new Date()));
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('60');
  const [times, setTimes] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // The start times of the day come from the opening hours, through the
  // availability grid of the courts.
  useEffect(() => {
    let cancelled = false;
    getJson(`/api/availability?date=${date}`).then(([grid, message]) => {
      if (cancelled) return;
      setTimes(grid?.slots ?? []);
      setError(message ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Any change of the slot hides the old table: it must be asked again.
  const change = (setter) => (event) => {
    setter(event.target.value);
    setResult(null);
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const query = new URLSearchParams({ date, start, duration });
    const [data, message] = await getJson(
      `/api/equipment/availability?${query}`,
    );
    setResult(data);
    setError(message ?? '');
  }

  return (
    <main>
      <h1>Equipment for rent</h1>
      <form onSubmit={handleSubmit}>
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
            Start time{' '}
            <select value={start} onChange={change(setStart)} required>
              <option value="">Choose a time</option>
              {times.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Duration{' '}
            <select value={duration} onChange={change(setDuration)}>
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        </p>
        <button type="submit">Show the equipment</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <table>
          <caption>
            Equipment from {result.start} to {result.end}
          </caption>
          <thead>
            <tr>
              <th scope="col">Equipment</th>
              <th scope="col">Price per booking</th>
              <th scope="col">Available</th>
            </tr>
          </thead>
          <tbody>
            {result.equipment.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.name}</th>
                <td>{item.rentalPrice} EUR</td>
                <td>{item.available > 0 ? item.available : 'None left'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
