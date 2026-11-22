import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fakeApi } from '../test/fakeApi.js';
import RentEquipment from './RentEquipment.jsx';

const DAY = '2026-11-25';

const grid = { date: DAY, slots: ['18:00', '18:30', '19:00'], courts: [] };

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
      available: 5,
    },
    {
      id: 2,
      name: 'Balls (tube of 3)',
      category: 'BALLS',
      rentalPrice: '5.00',
      available: 0,
    },
  ],
};

// Chooses the day, the start time and 90 minutes, then submits the form.
async function chooseSlot() {
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: DAY } });
  await screen.findByRole('option', { name: '18:00' });
  fireEvent.change(screen.getByLabelText('Start time'), {
    target: { value: '18:00' },
  });
  fireEvent.change(screen.getByLabelText('Duration'), {
    target: { value: '90' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show the equipment' }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Equipment for rent page', () => {
  it('shows each equipment type with its price and available quantity', async () => {
    const fetchMock = fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [`GET /api/equipment/availability?date=${DAY}&start=18%3A00&duration=90`]:
        { status: 200, body: equipment },
    });

    render(<RentEquipment />);
    await chooseSlot();

    expect(
      (await screen.findByRole('table')).querySelector('caption').textContent,
    ).toBe('Equipment from 18:00 to 19:30');
    const rows = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Racket', '4.00 EUR', '5'],
      ['Balls (tube of 3)', '5.00 EUR', 'None left'],
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/equipment/availability?date=${DAY}&start=18%3A00&duration=90`,
    );
  });

  it('offers the start times of the chosen day', async () => {
    fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
    });

    render(<RentEquipment />);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: DAY } });
    await screen.findByRole('option', { name: '18:00' });

    const options = screen
      .getByLabelText('Start time')
      .querySelectorAll('option:not([value=""])');
    expect([...options].map((o) => o.textContent)).toEqual([
      '18:00',
      '18:30',
      '19:00',
    ]);
  });

  it('shows the message sent by the API', async () => {
    fakeApi({
      [`GET /api/availability?date=${DAY}`]: { status: 200, body: grid },
      [`GET /api/equipment/availability?date=${DAY}&start=18%3A00&duration=90`]:
        {
          status: 400,
          body: { error: { message: 'duration must be 60 or 90 minutes' } },
        },
    });

    render(<RentEquipment />);
    await chooseSlot();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'duration must be 60 or 90 minutes',
    );
    expect(screen.queryByRole('table')).toBe(null);
  });
});
