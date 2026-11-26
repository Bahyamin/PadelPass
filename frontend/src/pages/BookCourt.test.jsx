import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { fakeApi } from '../test/fakeApi.js';
import BookCourt from './BookCourt.jsx';

const DAY = '2026-11-25'; // a Wednesday

const grid = {
  date: DAY,
  slots: ['17:30', '18:00', '18:30'],
  courts: [
    {
      id: 1,
      name: 'Court 1',
      slots: [
        { time: '17:30', status: 'BOOKED' },
        { time: '18:00', status: 'FREE' },
        { time: '18:30', status: 'FREE' },
      ],
    },
    {
      id: 2,
      name: 'Court 2',
      slots: [
        { time: '17:30', status: 'FREE' },
        { time: '18:00', status: 'CLOSED' },
        { time: '18:30', status: 'CLOSED' },
      ],
    },
  ],
};

const EQUIPMENT_URL = `GET /api/equipment/availability?date=${DAY}&start=18%3A00&duration=90`;

// FR-17: the equipment of the slot, with the quantity still available.
const equipment = {
  date: DAY,
  start: '18:00',
  end: '19:30',
  equipment: [
    {
      id: 1,
      name: 'Racket',
      category: 'RACKET',
      rentalPrice: '4.00',
      available: 3,
    },
    {
      id: 2,
      name: 'Balls',
      category: 'BALLS',
      rentalPrice: '5.00',
      available: 2,
    },
  ],
};

const QUOTE_URL = `GET /api/pricing/quote?courtId=1&date=${DAY}&start=18%3A00&duration=90`;

const summary = {
  courtId: 1,
  courtName: 'Court 1',
  date: DAY,
  start: '18:00',
  end: '19:30',
  duration: 90,
  price: '60.00',
};

// Opens the page as the availability grid does, with the slot in the URL.
const renderPage = (search = `?date=${DAY}&courtId=1&start=18:00`) =>
  render(
    <MemoryRouter initialEntries={[`/book/new${search}`]}>
      <BookCourt />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Book a court page', () => {
  it('shows the price before confirming, then books the court', async () => {
    const fetchMock = fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [QUOTE_URL]: { status: 200, body: summary },
      'POST /api/bookings': {
        status: 201,
        body: {
          ...summary,
          id: 7,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          courtPrice: '60.00',
          equipment: [],
          equipmentPrice: '0.00',
          totalPrice: '60.00',
        },
      },
    });

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });
    fireEvent.click(screen.getByLabelText('90 minutes'));
    fireEvent.click(screen.getByRole('button', { name: 'See the price' }));

    const section = await screen.findByRole('region', { name: 'Summary' });
    expect(section.textContent).toMatch(/Court 1, Wednesday 25 November/);
    expect(section.textContent).toMatch(/18:00 to 19:30 \(90 minutes\)/);
    expect(section.textContent).toMatch(/Total price: 60\.00 EUR/);

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the booking' }),
    );

    expect((await screen.findByRole('status')).textContent).toMatch(
      /Court 1, Wednesday 25 November, 18:00 to 19:30: 60\.00 EUR/,
    );
    const [url, options] = fetchMock.mock.calls.at(-1);
    expect(url).toBe('/api/bookings');
    expect(JSON.parse(options.body)).toEqual({
      courtId: 1,
      date: DAY,
      start: '18:00',
      duration: 90,
    });
  });

  it('only offers the free start times of the chosen court', async () => {
    fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
    });

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });

    const times = screen
      .getByLabelText('Start time')
      .querySelectorAll('option:not([value=""])');
    expect([...times].map((o) => o.textContent)).toEqual(['18:00', '18:30']);
  });

  it('shows the message of the API when the slot cannot be booked', async () => {
    fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [QUOTE_URL]: {
        status: 400,
        body: {
          error: {
            code: 'OUTSIDE_OPENING_HOURS',
            message: 'The club is open from 08:00 to 23:00 on this day',
          },
        },
      },
    });

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });
    fireEvent.click(screen.getByLabelText('90 minutes'));
    fireEvent.click(screen.getByRole('button', { name: 'See the price' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The club is open from 08:00 to 23:00 on this day',
    );
    expect(screen.queryByRole('button', { name: 'Confirm the booking' })).toBe(
      null,
    );
  });

  it('refreshes the grid when the slot was booked in the meantime', async () => {
    const routes = {
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [QUOTE_URL]: { status: 200, body: summary },
      'POST /api/bookings': {
        status: 409,
        body: {
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'This court is already booked',
          },
        },
      },
    };
    const fetchMock = fakeApi(routes);

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });
    fireEvent.click(screen.getByLabelText('90 minutes'));
    fireEvent.click(screen.getByRole('button', { name: 'See the price' }));
    await screen.findByRole('region', { name: 'Summary' });

    // Somebody else books 18:00 before the confirmation.
    const taken = structuredClone(grid);
    taken.courts[0].slots[1].status = 'BOOKED';
    routes[`GET /api/availability?date=${DAY}`] = { status: 200, body: taken };
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the booking' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This court is already booked',
    );
    expect(screen.queryByRole('region', { name: 'Summary' })).toBe(null);
    await vi.waitFor(() => {
      const times = screen
        .getByLabelText('Start time')
        .querySelectorAll('option:not([value=""])');
      expect([...times].map((o) => o.textContent)).toEqual(['18:30']);
    });
    const gridCalls = fetchMock.mock.calls.filter(
      ([url]) => url === `/api/availability?date=${DAY}`,
    );
    expect(gridCalls).toHaveLength(2);
  });

  it('adds rackets and balls: the total price is updated and sent with the booking', async () => {
    const fetchMock = fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [QUOTE_URL]: { status: 200, body: summary },
      [EQUIPMENT_URL]: { status: 200, body: equipment },
      'POST /api/bookings': {
        status: 201,
        body: {
          ...summary,
          id: 7,
          courtPrice: '60.00',
          equipment: [
            { typeId: 1, name: 'Racket', quantity: 2, unitPrice: '4.00' },
            { typeId: 2, name: 'Balls', quantity: 1, unitPrice: '5.00' },
          ],
          equipmentPrice: '13.00',
          totalPrice: '73.00',
        },
      },
    });

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });
    fireEvent.click(screen.getByLabelText('90 minutes'));
    fireEvent.click(screen.getByRole('button', { name: 'See the price' }));
    const racket = await screen.findByLabelText('Racket quantity');
    expect(racket.getAttribute('max')).toBe('3');

    fireEvent.change(racket, { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Balls quantity'), {
      target: { value: '1' },
    });
    const section = screen.getByRole('region', { name: 'Summary' });
    expect(section.textContent).toMatch(/Equipment: 13\.00 EUR/);
    expect(section.textContent).toMatch(/Total price: 73\.00 EUR/);

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the booking' }),
    );

    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/18:00 to 19:30: 73\.00 EUR/);
    expect(screen.getByText('Equipment: 2 × Racket, 1 × Balls')).toBeTruthy();
    const [, options] = fetchMock.mock.calls.at(-1);
    expect(JSON.parse(options.body)).toEqual({
      courtId: 1,
      date: DAY,
      start: '18:00',
      duration: 90,
      equipment: [
        { typeId: 1, quantity: 2 },
        { typeId: 2, quantity: 1 },
      ],
    });
  });

  it('shows the message when the equipment is no longer available', async () => {
    const routes = {
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [QUOTE_URL]: { status: 200, body: summary },
      [EQUIPMENT_URL]: { status: 200, body: equipment },
      'POST /api/bookings': {
        status: 409,
        body: {
          error: {
            code: 'EQUIPMENT_UNAVAILABLE',
            message: 'Only 1 × Racket available for this slot, you asked for 3',
          },
        },
      },
    };
    const fetchMock = fakeApi(routes);

    renderPage();
    await screen.findByRole('option', { name: 'Court 1' });
    fireEvent.click(screen.getByLabelText('90 minutes'));
    fireEvent.click(screen.getByRole('button', { name: 'See the price' }));
    fireEvent.change(await screen.findByLabelText('Racket quantity'), {
      target: { value: '3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the booking' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only 1 × Racket available for this slot, you asked for 3',
    );
    // The summary stays, and the stock of the slot is asked again.
    expect(screen.getByRole('region', { name: 'Summary' })).toBeTruthy();
    const equipmentCalls = fetchMock.mock.calls.filter(([url]) =>
      url.startsWith('/api/equipment/availability'),
    );
    expect(equipmentCalls).toHaveLength(2);
  });
});
