import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';

const URL = '/api/bookings/2/equipment';

const view = {
  booking: {
    id: 2,
    courtName: 'Court 1',
    date: '2026-11-25',
    start: '18:00',
    end: '19:30',
    courtPrice: '60.00',
    equipmentPrice: '4.00',
    feesTotal: '0.00',
    totalPrice: '64.00',
  },
  changeDeadline: '2026-11-25T16:00',
  canChange: true,
  equipment: [
    {
      typeId: 1,
      name: 'Racket',
      category: 'RACKET',
      unitPrice: '4.00',
      quantity: 1,
      available: 3,
    },
    {
      typeId: 2,
      name: 'Balls',
      category: 'BALLS',
      unitPrice: '5.00',
      quantity: 0,
      available: 2,
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/my-bookings/2/equipment']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Equipment of my booking page', () => {
  it('shows the booking, the deadline, the quantities and the total price', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      [`GET ${URL}`]: { status: 200, body: view },
    });
    renderPage();

    expect((await screen.findByLabelText('Racket quantity')).value).toBe('1');
    expect(screen.getByLabelText('Balls quantity').value).toBe('0');
    expect(screen.getByLabelText('Balls quantity').getAttribute('max')).toBe(
      '2',
    );
    expect(
      screen.getByText('Court 1, 2026-11-25, 18:00 to 19:30'),
    ).toBeTruthy();
    expect(
      screen.getByText('You can change the equipment until 2026-11-25 16:00.'),
    ).toBeTruthy();
    expect(screen.getByText('Total price:').textContent).toBe(
      'Total price: 64.00 EUR',
    );
  });

  it('updates the total with the quantities, then saves them', async () => {
    const fetchMock = fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      [`GET ${URL}`]: { status: 200, body: view },
      [`PUT ${URL}`]: {
        status: 200,
        body: { ...view.booking, equipmentPrice: '18.00', totalPrice: '78.00' },
      },
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText('Racket quantity'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Balls quantity'), {
      target: { value: '2' },
    });
    expect(screen.getByText('Equipment: 18.00 EUR')).toBeTruthy();
    expect(screen.getByText('Total price:').textContent).toBe(
      'Total price: 78.00 EUR',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save the equipment' }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'Equipment saved. New total price: 78.00 EUR',
    );
    const [, options] = fetchMock.mock.calls.find(
      ([url, o]) => url === URL && o?.method === 'PUT',
    );
    expect(JSON.parse(options.body)).toEqual({
      equipment: [
        { typeId: 1, quantity: 2 },
        { typeId: 2, quantity: 2 },
      ],
    });
  });

  it('shows the message of the API when the change is refused', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      [`GET ${URL}`]: { status: 200, body: view },
      [`PUT ${URL}`]: {
        status: 409,
        body: {
          error: {
            code: 'EQUIPMENT_UNAVAILABLE',
            message: 'Only 2 × Balls available for this slot, you asked for 3',
          },
        },
      },
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText('Balls quantity'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save the equipment' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only 2 × Balls available for this slot, you asked for 3',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cannot be changed any more after the deadline', async () => {
    fakeApi({
      'GET /api/users/me': { status: 200, body: ada },
      [`GET ${URL}`]: { status: 200, body: { ...view, canChange: false } },
    });
    renderPage();

    expect((await screen.findByLabelText('Racket quantity')).disabled).toBe(
      true,
    );
    expect(
      screen.getByText(
        'The equipment could be changed until 2026-11-25 16:00.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Save the equipment' }),
    ).toBeNull();
  });
});
