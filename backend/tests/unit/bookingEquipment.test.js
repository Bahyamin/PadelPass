import { describe, it, expect } from 'vitest';
import {
  bookingPrices,
  checkEquipment,
} from '../../src/modules/bookings/bookingEquipment.js';

const stock = [
  { id: 1, name: 'Racket', rentalPrice: '4.00', isActive: true, available: 2 },
  { id: 2, name: 'Balls', rentalPrice: '5.00', isActive: true, available: 0 },
  {
    id: 3,
    name: 'Old bag',
    rentalPrice: '1.00',
    isActive: false,
    available: 5,
  },
];

// RULE-08, FR-19: the equipment asked is checked against the stock.
describe('checkEquipment', () => {
  it('returns the rows to save at the rental price, without the quantities at 0', () => {
    expect(
      checkEquipment(
        [
          { typeId: 1, quantity: 2 },
          { typeId: 2, quantity: 0 },
        ],
        stock,
      ),
    ).toEqual([{ typeId: 1, quantity: 2, unitPrice: '4.00' }]);
  });

  it('keeps the price of equipment already reserved', () => {
    expect(
      checkEquipment([{ typeId: 1, quantity: 1 }], stock, { 1: '3.50' }),
    ).toEqual([{ typeId: 1, quantity: 1, unitPrice: '3.50' }]);
  });

  it('refuses more than the available quantity, with a message', () => {
    expect(() => checkEquipment([{ typeId: 1, quantity: 3 }], stock)).toThrow(
      'Only 2 × Racket available for this slot, you asked for 3',
    );
    expect(() => checkEquipment([{ typeId: 2, quantity: 1 }], stock)).toThrow(
      'Only 0 × Balls available',
    );
  });

  it('refuses an unknown or inactive type', () => {
    for (const typeId of [3, 99]) {
      expect(() => checkEquipment([{ typeId, quantity: 1 }], stock)).toThrow(
        'This equipment does not exist',
      );
    }
  });
});

describe('bookingPrices', () => {
  it('adds the court, the equipment and the fees, in cents', () => {
    const prices = bookingPrices({
      courtPrice: '60.00',
      feesTotal: '0.10',
      equipment: [
        { typeId: 1, quantity: 3, unitPrice: '0.10', type: { name: 'Grip' } },
        { typeId: 2, quantity: 1, unitPrice: '0.20', type: { name: 'Ball' } },
      ],
    });

    expect(prices).toEqual({
      courtPrice: '60.00',
      equipment: [
        { typeId: 1, name: 'Grip', quantity: 3, unitPrice: '0.10' },
        { typeId: 2, name: 'Ball', quantity: 1, unitPrice: '0.20' },
      ],
      equipmentPrice: '0.50',
      feesTotal: '0.10',
      totalPrice: '60.60',
    });
  });
});
