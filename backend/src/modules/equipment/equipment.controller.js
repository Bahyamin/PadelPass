import { ValidationError } from '../../utils/errors.js';
import { equipmentSlotSchema } from './equipment.schemas.js';
import { equipmentService } from './equipment.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const equipmentController = {
  async getAvailability(req, res) {
    const result = equipmentSlotSchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0].message);
    }
    res.json(await equipmentService.getAvailability(result.data));
  },
};
