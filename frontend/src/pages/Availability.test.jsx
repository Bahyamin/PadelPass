import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Availability from './Availability.jsx';

const grid = (date) => ({
  date,
  openTime: '08:00',
  closeTime: '09:00',
  slots: ['08:00', '08:30'],
  courts: [
    {
      id: 1,
      name: 'Court 1',
      type: 'INDOOR',
      slots: [
        { time: '08:00', status: 'BOOKED' },
        { time: '08:30', status: 'FREE' },
      ],
    },
    {
      id: 2,
      name: 'Court 2',
      type: 'INDOOR',
      slots: [
        { time: '08:00', status: 'CLOSED' },
        { time: '08:30', status: 'CLOSED' },
      ],
    },
  ],
});

const respondWithGrid = () =>
  vi.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(grid(url.split('date=')[1])),
    }),
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Availability page', () => {
  it('shows the grid of today with a status in every cell', async () => {
    vi.stubGlobal('fetch', respondWithGrid());

    render(<Availability />);

    expect(
      await screen.findByRole('rowheader', { name: 'Court 1' }),
    ).toBeTruthy();
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual(['Booked', 'Free', 'Closed', 'Closed']);
    expect(screen.getByRole('columnheader', { name: '08:30' })).toBeTruthy();
  });

  it('offers today and the next 14 days, and reloads the grid for the chosen day', async () => {
    const fetchMock = respondWithGrid();
    vi.stubGlobal('fetch', fetchMock);

    render(<Availability />);
    await screen.findByRole('table');

    const dayButtons = screen.getAllByRole('button');
    expect(dayButtons).toHaveLength(15);

    fireEvent.click(dayButtons[3]);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [firstUrl] = fetchMock.mock.calls[0];
    const [secondUrl] = fetchMock.mock.calls[1];
    expect(firstUrl).toMatch(/^\/api\/availability\?date=\d{4}-\d{2}-\d{2}$/);
    expect(secondUrl).not.toBe(firstUrl);
    expect(dayButtons[3].getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the message sent by the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            error: {
              code: 'OUTSIDE_BOOKING_WINDOW',
              message: 'date must be between 2026-11-16 and 2026-11-30',
            },
          }),
      }),
    );

    render(<Availability />);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'date must be between 2026-11-16 and 2026-11-30',
    );
  });
});
