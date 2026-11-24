import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { fakeApi } from '../test/fakeApi.js';
import AdminCourts from './AdminCourts.jsx';

const courts = [
  {
    id: 1,
    name: 'Court 1',
    type: 'INDOOR',
    isActive: true,
    closures: [
      {
        id: 5,
        courtId: 1,
        start: '2026-11-30T10:00',
        end: '2026-11-30T12:00',
        reason: 'Net replacement',
      },
    ],
  },
  { id: 2, name: 'Court 2', type: 'OUTDOOR', isActive: false, closures: [] },
];

// The courts API, plus the extra routes of a test.
const courtsApi = (routes = {}) =>
  fakeApi({
    'GET /api/admin/courts': { status: 200, body: courts },
    ...routes,
  });

// The method, url and JSON body of the last call to fetch with this method.
const lastCall = (fetchMock, method) => {
  const [url, options] = fetchMock.mock.calls.findLast(
    ([, options]) => options?.method === method,
  );
  return { url, body: JSON.parse(options.body) };
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminCourts />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Courts and closures page', () => {
  it('lists the courts with their type, status and closures to come', async () => {
    courtsApi();
    renderPage();

    const row1 = (await screen.findByRole('cell', { name: 'Court 1' }))
      .parentElement;
    expect(within(row1).getByText('Indoor')).toBeTruthy();
    expect(within(row1).getByText('Active')).toBeTruthy();
    expect(
      within(row1).getByText(
        '2026-11-30 10:00 to 2026-11-30 12:00: Net replacement',
      ),
    ).toBeTruthy();
    const row2 = screen.getByRole('cell', { name: 'Court 2' }).parentElement;
    expect(within(row2).getByText('Outdoor')).toBeTruthy();
    expect(within(row2).getByText('Inactive')).toBeTruthy();
    expect(
      within(row2).getByRole('button', { name: 'Reactivate Court 2' }),
    ).toBeTruthy();
  });

  it('adds a court with its name and type', async () => {
    const fetchMock = courtsApi({
      'POST /api/admin/courts': {
        status: 201,
        body: { id: 3, name: 'Court 3', type: 'OUTDOOR', isActive: true },
      },
    });
    renderPage();
    await screen.findByRole('cell', { name: 'Court 1' });

    const form = screen.getByRole('form', { name: 'Court' });
    fireEvent.change(within(form).getByLabelText('Name'), {
      target: { value: 'Court 3' },
    });
    fireEvent.change(within(form).getByLabelText('Type'), {
      target: { value: 'OUTDOOR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add the court' }));

    expect((await screen.findByRole('status')).textContent).toBe('Court added');
    expect(lastCall(fetchMock, 'POST')).toEqual({
      url: '/api/admin/courts',
      body: { name: 'Court 3', type: 'OUTDOOR' },
    });
  });

  it('shows why a court cannot be deactivated', async () => {
    const fetchMock = courtsApi({
      'PATCH /api/admin/courts/1': {
        status: 409,
        body: {
          error: {
            code: 'COURT_HAS_BOOKINGS',
            message: 'This court still has 2 upcoming booking(s).',
          },
        },
      },
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Deactivate Court 1' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This court still has 2 upcoming booking(s).',
    );
    expect(lastCall(fetchMock, 'PATCH').body).toEqual({ isActive: false });
  });

  it('closes a court for a period and lists the cancelled bookings', async () => {
    const fetchMock = courtsApi({
      'POST /api/admin/courts/1/closures': {
        status: 201,
        body: {
          id: 6,
          courtId: 1,
          start: '2026-12-01T08:00',
          end: '2026-12-01T12:00',
          reason: 'Resurfacing',
          cancelledBookings: [
            {
              id: 9,
              date: '2026-12-01',
              start: '10:00',
              end: '11:30',
              player: 'Ada Lovelace',
            },
          ],
        },
      },
    });
    renderPage();
    await screen.findByRole('cell', { name: 'Court 1' });

    const form = screen.getByRole('form', { name: 'Closure' });
    fireEvent.change(within(form).getByLabelText('Court'), {
      target: { value: '1' },
    });
    fireEvent.change(within(form).getByLabelText('From'), {
      target: { value: '2026-12-01T08:00' },
    });
    fireEvent.change(within(form).getByLabelText('To'), {
      target: { value: '2026-12-01T12:00' },
    });
    fireEvent.change(within(form).getByLabelText('Reason'), {
      target: { value: 'Resurfacing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close the court' }));

    const result = await screen.findByRole('region', {
      name: 'Closure saved',
    });
    expect(within(result).getByRole('status').textContent).toBe(
      'Court 1 closed from 2026-12-01 08:00 to 2026-12-01 12:00. 1 booking(s) cancelled, the players were notified by email.',
    );
    expect(
      within(result).getByText('2026-12-01 10:00-11:30: Ada Lovelace'),
    ).toBeTruthy();
    expect(lastCall(fetchMock, 'POST')).toEqual({
      url: '/api/admin/courts/1/closures',
      body: {
        start: '2026-12-01T08:00',
        end: '2026-12-01T12:00',
        reason: 'Resurfacing',
      },
    });
  });
});
