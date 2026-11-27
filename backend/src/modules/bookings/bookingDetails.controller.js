import { bookingDetailsService } from './bookingDetails.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const bookingDetailsController = {
  async get(req, res) {
    res.json(await bookingDetailsService.get(req.user, Number(req.params.id)));
  },
};
