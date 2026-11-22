import { describe, it, expect } from 'vitest';
import { computeEquipmentAvailability } from '../../src/modules/equipment/equipmentAvailability.js';

const types = [
  { id: 1, name: 'Racket', category: 'RACKET', rentalPrice: '4' },
  { id: 2, name: 'Shoes', category: 'SHOES', rentalPrice: '3.5' },
];

describe('computeEquipmentAvailability', () => {
  it('gives the name, the price and the items in service minus the reserved quantity', () => {
    const result = computeEquipmentAvailability({
      types,
      inService: { 1: 8, 2: 6 },
      reserved: { 1: 3 },
    });

    expect(result).toEqual([
      {
        id: 1,
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: '4.00',
        available: 5,
      },
      {
        id: 2,
        name: 'Shoes',
        category: 'SHOES',
        rentalPrice: '3.50',
        available: 6,
      },
    ]);
  });

  it('gives 0 for a type without any item in service', () => {
    const [racket] = computeEquipmentAvailability({
      types,
      inService: {},
      reserved: {},
    });

    expect(racket.available).toBe(0);
  });

  it('never goes below 0, even if more is reserved than in service', () => {
    const [racket] = computeEquipmentAvailability({
      types,
      inService: { 1: 2 },
      reserved: { 1: 3 },
    });

    expect(racket.available).toBe(0);
  });
});
