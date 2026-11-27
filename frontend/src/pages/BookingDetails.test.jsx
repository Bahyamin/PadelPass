import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';

const staff = { ...ada, firstName: 'Sam', role: 'STAFF' };

const details = {
  id: 7,
  courtId: 1,
  courtName: 'Court 1',
  date: '2026-12-02',
  start: '18:00',
  end: '19:30',
  duration: 90,
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  courtPrice: '60.00',
  equipment: [{ typeId: 1, name: 'Racket', quantity: 2, unitPrice: '4.00' }],
  equipmentPrice: '8.00',
  feesTotal: '0.00',
  totalPrice: '68.00',
  player: {
    id: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '0612345678',
  },
  guest: null,
  rentals: [
    {
      id: 3,
      code: 'RKT-01',
      typeName: 'Racket',
      pickedUpAt: '2026-12-02T17:55',
      returnedAt: null,
      returnCondition: null,
    },
  ],
};

const renderPage = (routes) => {
  fakeApi({ 'GET /api/users/me': { status: 200, body: staff }, ...routes });
  render(
    <MemoryRouter initialEntries={['/staff/bookings/7']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Booking details page', () => {
  it('shows the booking, the player, the payment and the items handed out', async () => {
    renderPage({ 'GET /api/bookings/7': { status: 200, body: details } });

    expect(
      await screen.findByText(
        /^Court 1, Wednesday,? 2 December 2026, 18:00 to 19:30 \(90 minutes\)$/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Player: Ada Lovelace, ada@example.com, 0612345678'),
    ).toBeTruthy();
    expect(screen.getByText('Payment: Unpaid')).toBeTruthy();
    expect(screen.getByText('Reserved: 2 × Racket')).toBeTruthy();

    const items = within(screen.getByRole('table'));
    expect(items.getByText('RKT-01')).toBeTruthy();
    expect(items.getByText('2026-12-02 17:55')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Back to the planning' })
        .getAttribute('href'),
    ).toBe('/staff/planning?date=2026-12-02');
  });

  it('shows the guest of a booking without items handed out', async () => {
    renderPage({
      'GET /api/bookings/7': {
        status: 200,
        body: {
          ...details,
          player: null,
          guest: { name: 'John Guest', phone: '0699999999' },
          equipment: [],
          rentals: [],
        },
      },
    });

    expect(
      await screen.findByText('Guest: John Guest, 0699999999'),
    ).toBeTruthy();
    expect(screen.getByText('Reserved: none')).toBeTruthy();
    expect(screen.getByText('No item handed out yet.')).toBeTruthy();
  });

  it('shows the message of the API for an unknown booking', async () => {
    renderPage({
      'GET /api/bookings/7': {
        status: 404,
        body: {
          error: {
            code: 'BOOKING_NOT_FOUND',
            message: 'This booking does not exist',
          },
        },
      },
    });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This booking does not exist',
    );
  });
});
