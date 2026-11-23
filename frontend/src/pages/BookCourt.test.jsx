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
    expect(section.textContent).toMatch(/Price: 60\.00 EUR/);

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
});
