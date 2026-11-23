// Statuses of an item that is part of the stock. DAMAGED, MAINTENANCE and LOST
// items are out of service. A RENTED item is in use now but comes back after
// its booking, so it still counts for a later slot (SDD 6.2).
export const IN_SERVICE_STATUSES = ['AVAILABLE', 'RENTED'];

// Available quantity of each equipment type for a slot (SDD 6.2, FR-17,
// RULE-08): items in service minus the quantities reserved by the confirmed
// bookings that overlap the slot, never below 0.
// - types: the active equipment types
// - inService: { [typeId]: number of items in service }
// - reserved: { [typeId]: quantity reserved during the slot }
// Pure function: it only uses its arguments, so it is easy to unit test.
export function computeEquipmentAvailability({ types, inService, reserved }) {
  return types.map((type) => ({
    id: type.id,
    name: type.name,
    category: type.category,
    rentalPrice: Number(type.rentalPrice).toFixed(2),
    available: Math.max(
      0,
      (inService[type.id] ?? 0) - (reserved[type.id] ?? 0),
    ),
  }));
}
