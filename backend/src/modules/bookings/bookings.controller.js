import { ValidationError } from '../../utils/errors.js';
import { slotSchema } from './bookings.schemas.js';
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
};
