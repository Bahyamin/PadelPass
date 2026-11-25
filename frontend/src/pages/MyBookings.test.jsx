import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';

const upcoming = {
  id: 2,
  date: '2026-11-25',
  start: '18:00',
  end: '19:30',
  duration: 90,
  courtName: 'Court 1',
  equipment: [
    { name: 'Racket', quantity: 2, unitPrice: '4.00' },
    { name: 'Balls (tube of 3)', quantity: 1, unitPrice: '5.00' },
  ],
  courtPrice: '60.00',
  equipmentPrice: '13.00',
  feesTotal: '0.00',
  totalPrice: '73.00',
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
};

const past = {
  ...upcoming,
  id: 1,
  date: '2026-11-10',
  start: '10:00',
  end: '11:00',
  duration: 60,
  courtName: 'Court 2',
  equipment: [],
  totalPrice: '28.00',
  status: 'COMPLETED',
  paymentStatus: 'PAID',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/my-bookings']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('My bookings page', () => {
  it('shows the upcoming bookings first, then the past ones, with all their details', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      'GET /api/bookings/me': {
        status: 200,
        body: { upcoming: [upcoming], past: [past] },
      },
    });

    renderPage();

    const upcomingSection = await screen.findByRole('region', {
      name: 'Upcoming bookings',
    });
    const pastSection = screen.getByRole('region', { name: 'Past bookings' });
    // Upcoming comes before past in the page.
    expect(
      upcomingSection.compareDocumentPosition(pastSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const [, row] = within(upcomingSection).getAllByRole('row');
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Wed, 25 Nov 2026',
      '18:00 - 19:30',
      'Court 1',
      '90 min',
      '2 × Racket, 1 × Balls (tube of 3)',
      '73.00 EUR',
      'Confirmed',
      'To pay at the club',
    ]);

    const [, pastRow] = within(pastSection).getAllByRole('row');
    expect(pastRow.textContent).toMatch(/Court 2/);
    expect(pastRow.textContent).toMatch(/None/);
    expect(pastRow.textContent).toMatch(/Completed/);
    expect(pastRow.textContent).toMatch(/Paid/);
  });

  it('says when a list is empty', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      'GET /api/bookings/me': {
        status: 200,
        body: { upcoming: [], past: [] },
      },
    });

    renderPage();

    expect(await screen.findByText('No upcoming booking.')).toBeTruthy();
    expect(screen.getByText('No past booking.')).toBeTruthy();
  });

  it('sends a visitor who is not logged in to the login page', async () => {
    fakeApi({ 'GET /api/users/me': { status: 401, body: {} } });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeTruthy();
  });
});
