import { ValidationError } from '../../utils/errors.js';
import { slotSchema } from './bookings.schemas.js';
import { bookingEquipmentService } from './bookingEquipment.service.js';
import { bookingsService } from './bookings.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const bookingsController = {
  // The quote reads the slot from the query string, checked with the same
  // schema as the booking body.
  async quote(req, res) {
    const result = slotSchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0].message);
    }
    res.json(await bookingsService.quote(result.data));
  },

  async create(req, res) {
    res.status(201).json(await bookingsService.create(req.user.id, req.body));
  },

  async getEquipment(req, res) {
    res.json(
      await bookingEquipmentService.get(req.user, Number(req.params.id)),
    );
  },

  async changeEquipment(req, res) {
    res.json(
      await bookingEquipmentService.change(
        req.user,
        Number(req.params.id),
        req.body.equipment,
      ),
    );
  },
};
