import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthContext.jsx';
import RequireAuth from '../auth/RequireAuth.jsx';
import { ada, fakeApi } from '../test/fakeApi.js';
import AdminSettings from './AdminSettings.jsx';

const admin = { ...ada, role: 'ADMIN' };

const hours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  closed: false,
  openTime: '08:00',
  closeTime: '23:00',
}));

const peak = {
  id: 4,
  dayOfWeek: 3,
  startTime: '17:00',
  endTime: '22:00',
  pricePerHour: '40.00',
  label: 'Peak',
};

const settings = {
  maxActiveBookings: 3,
  bookingWindowDays: 14,
  cancellationDeadlineHours: 24,
  equipmentChangeDeadlineHours: 2,
};

// The admin API answers, plus the extra routes of a test.
function adminApi(routes = {}) {
  return fakeApi({
    'GET /api/users/me': { status: 200, body: admin },
    'GET /api/admin/opening-hours': { status: 200, body: hours },
    'GET /api/admin/pricing-rules': { status: 200, body: [peak] },
    'GET /api/admin/settings': { status: 200, body: settings },
    ...routes,
  });
}

// The method, url and JSON body of the last call to fetch.
const lastCall = (fetchMock) => {
  const [url, options] = fetchMock.mock.calls.at(-1);
  return {
    method: options.method,
    url,
    body: options.body && JSON.parse(options.body),
  };
};

// As in App.jsx: the page is behind RequireAuth, so the user is loaded.
const renderWithAuth = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <RequireAuth>
          <AdminSettings />
        </RequireAuth>
      </AuthProvider>
    </MemoryRouter>,
  );

const renderPage = async () => {
  renderWithAuth();
  await screen.findByRole('cell', { name: 'Peak' });
};

const section = (name) => screen.getByRole('region', { name });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Club settings page', () => {
  it('is for administrators only', async () => {
    fakeApi({ 'GET /api/users/me': { status: 200, body: ada } });

    renderWithAuth();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This page is for administrators only.',
    );
  });

  it('sets the opening and closing time of each day', async () => {
    const fetchMock = adminApi({
      'PUT /api/admin/opening-hours': { status: 200, body: hours },
    });
    await renderPage();

    fireEvent.change(screen.getByLabelText('Monday opens'), {
      target: { value: '09:00' },
    });
    fireEvent.click(screen.getByLabelText('Sunday closed'));
    expect(screen.getByLabelText('Sunday opens').disabled).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Save the opening hours' }),
    );

    expect(
      await within(section('Opening hours')).findByText('Opening hours saved'),
    ).toBeTruthy();
    const { method, url, body } = lastCall(fetchMock);
    expect([method, url]).toEqual(['PUT', '/api/admin/opening-hours']);
    expect(body[1]).toMatchObject({ dayOfWeek: 1, openTime: '09:00' });
    expect(body[0]).toMatchObject({ dayOfWeek: 0, closed: true });
  });

  it('adds a pricing rule', async () => {
    const fetchMock = adminApi({
      'POST /api/admin/pricing-rules': {
        status: 201,
        body: { ...peak, id: 5 },
      },
    });
    await renderPage();
    const form = screen.getByRole('form', { name: 'Pricing rule' });

    fireEvent.change(within(form).getByLabelText('Day'), {
      target: { value: '0' },
    });
    fireEvent.change(within(form).getByLabelText('From'), {
      target: { value: '08:00' },
    });
    fireEvent.change(within(form).getByLabelText('To'), {
      target: { value: '23:00' },
    });
    fireEvent.change(within(form).getByLabelText('Price per hour (EUR)'), {
      target: { value: '45.5' },
    });
    fireEvent.change(within(form).getByLabelText('Label'), {
      target: { value: 'Weekend' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Add the rule' }));

    expect(
      await within(section('Pricing rules')).findByText('Rule added'),
    ).toBeTruthy();
    const post = fetchMock.mock.calls.find(
      ([, options]) => options?.method === 'POST',
    );
    expect(post[0]).toBe('/api/admin/pricing-rules');
    expect(JSON.parse(post[1].body)).toEqual({
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '23:00',
      pricePerHour: 45.5,
      label: 'Weekend',
    });
  });

  it('edits a pricing rule', async () => {
    const fetchMock = adminApi({
      'PATCH /api/admin/pricing-rules/4': { status: 200, body: peak },
    });
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Pricing rule' });
    expect(within(form).getByLabelText('From').value).toBe('17:00');
    fireEvent.change(within(form).getByLabelText('Price per hour (EUR)'), {
      target: { value: '42' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Save the rule' }),
    );

    expect(
      await within(section('Pricing rules')).findByText('Rule updated'),
    ).toBeTruthy();
    const patch = fetchMock.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    );
    expect(patch[0]).toBe('/api/admin/pricing-rules/4');
    expect(JSON.parse(patch[1].body).pricePerHour).toBe(42);
  });

  it('deletes a pricing rule', async () => {
    const fetchMock = adminApi({
      'DELETE /api/admin/pricing-rules/4': { status: 204, body: null },
    });
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await within(section('Pricing rules')).findByText('Rule deleted'),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url === '/api/admin/pricing-rules/4' && options?.method === 'DELETE',
      ),
    ).toBe(true);
  });

  it('shows the message of the API when a rule overlaps another one', async () => {
    adminApi({
      'POST /api/admin/pricing-rules': {
        status: 409,
        body: {
          error: {
            code: 'PRICING_RULE_OVERLAP',
            message: 'This time range overlaps the rule "Peak" (17:00-22:00)',
          },
        },
      },
    });
    await renderPage();
    const form = screen.getByRole('form', { name: 'Pricing rule' });

    fireEvent.submit(form);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This time range overlaps the rule "Peak" (17:00-22:00)',
    );
  });

  it('changes the booking limit, the booking window and the cancellation deadline', async () => {
    const fetchMock = adminApi({
      'PUT /api/admin/settings': {
        status: 200,
        body: { ...settings, maxActiveBookings: 5 },
      },
    });
    await renderPage();

    fireEvent.change(
      screen.getByLabelText('Maximum active bookings per player'),
      { target: { value: '5' } },
    );
    fireEvent.change(screen.getByLabelText('Booking window (days ahead)'), {
      target: { value: '21' },
    });
    fireEvent.change(
      screen.getByLabelText('Cancellation deadline (hours before the start)'),
      { target: { value: '48' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save the parameters' }),
    );

    expect(
      await within(section('Booking parameters')).findByText(
        'Booking parameters saved',
      ),
    ).toBeTruthy();
    expect(lastCall(fetchMock)).toEqual({
      method: 'PUT',
      url: '/api/admin/settings',
      body: {
        maxActiveBookings: 5,
        bookingWindowDays: 21,
        cancellationDeadlineHours: 48,
        equipmentChangeDeadlineHours: 2,
      },
    });
  });
});
