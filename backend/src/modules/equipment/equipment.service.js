import { addMinutes, clubTime } from '../../utils/time.js';
import { equipmentRepository } from './equipment.repository.js';
import { computeEquipmentAvailability } from './equipmentAvailability.js';

export const equipmentService = {
  // Equipment catalogue with the quantity available for a slot (FR-17).
  async getAvailability({ date, start, duration }) {
    const end = addMinutes(start, duration);
    const [types, inService, reserved] = await Promise.all([
      equipmentRepository.findActiveTypes(),
      equipmentRepository.countInService(),
      equipmentRepository.sumReserved(
        clubTime(date, start),
        clubTime(date, end),
      ),
    ]);

    return {
      date,
      start,
      end,
      equipment: computeEquipmentAvailability({ types, inService, reserved }),
    };
  },
};
