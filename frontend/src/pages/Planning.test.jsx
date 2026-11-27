import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';

const staff = { ...ada, firstName: 'Sam', role: 'STAFF' };

const SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'];

const planning = {
  date: '2026-12-02',
  openTime: '08:00',
  closeTime: '11:00',
  slots: SLOTS,
  courts: [
    {
      id: 1,
      name: 'Court 1',
      type: 'INDOOR',
      isActive: true,
      closures: [],
      bookings: [
        {
          id: 7,
          start: '08:30',
          end: '10:00',
          duration: 90,
          status: 'CONFIRMED',
          player: 'Ada Lovelace',
          isGuest: false,
          phone: '0612345678',
          equipment: [{ name: 'Racket', quantity: 2 }],
          paymentStatus: 'PAID',
          totalPrice: '68.00',
        },
      ],
    },
    {
      id: 2,
      name: 'Court 2',
      type: 'OUTDOOR',
      isActive: true,
      closures: [{ start: '10:00', end: '24:00', reason: 'Repair' }],
      bookings: [
        {
          id: 8,
          start: '08:00',
          end: '09:00',
          duration: 60,
          status: 'CONFIRMED',
          player: 'John Guest',
          isGuest: true,
          phone: '0699999999',
          equipment: [],
          paymentStatus: 'UNPAID',
          totalPrice: '28.00',
        },
      ],
    },
  ],
};

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Daily planning page', () => {
  it('shows each court with its bookings on the timeline of the day', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: staff },
      'GET /api/staff/planning?date=2026-12-02': {
        status: 200,
        body: planning,
      },
    });
    renderApp('/staff/planning?date=2026-12-02');

    const booking = await screen.findByRole('link', {
      name: '08:30-10:00 Ada Lovelace',
    });
    expect(booking.getAttribute('href')).toBe('/staff/bookings/7');
    const cell = booking.closest('td');
    expect(cell.colSpan).toBe(3);
    expect(cell.textContent).toBe(
      '08:30-10:00 Ada Lovelace (2 × Racket; Paid)',
    );

    const court2 = screen.getByRole('row', { name: /Court 2/ });
    expect(
      within(court2).getByRole('link', {
        name: '08:00-09:00 Guest: John Guest',
      }),
    ).toBeTruthy();
    expect(court2.textContent).toContain('(No equipment; Unpaid)');
    expect(within(court2).getAllByText('Closed')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('loads another day', async () => {
    const fetchMock = fakeApi({
      'GET /api/users/me': { status: 200, body: staff },
      'GET /api/staff/planning?date=2026-12-02': {
        status: 200,
        body: planning,
      },
      'GET /api/staff/planning?date=2026-12-03': {
        status: 200,
        body: { ...planning, date: '2026-12-03', courts: [] },
      },
    });
    renderApp('/staff/planning?date=2026-12-02');

    await screen.findByText(/^Planning of Wednesday,? 2 December 2026$/);
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));

    expect(
      await screen.findByText(/^Planning of Thursday,? 3 December 2026$/),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/staff/planning?date=2026-12-03',
    );
  });

  it('says when the club is closed and has no booking', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: staff },
      'GET /api/staff/planning?date=2026-12-25': {
        status: 200,
        body: { ...planning, slots: [], openTime: null, closeTime: null },
      },
    });
    renderApp('/staff/planning?date=2026-12-25');

    expect(
      await screen.findByText(
        'The club is closed this day and has no booking.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('is linked from the home page for staff only', async () => {
    fakeApi({
      'GET /api/health': { status: 200, body: { status: 'OK' } },
      'GET /api/users/me': { status: 200, body: staff },
    });
    renderApp('/');
    expect(
      await screen.findByRole('link', { name: 'Daily planning' }),
    ).toBeTruthy();
    cleanup();

    fakeApi({
      'GET /api/health': { status: 200, body: { status: 'OK' } },
      'GET /api/users/me': { status: 200, body: ada },
    });
    renderApp('/');
    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Daily planning' })).toBeNull();
  });
});
