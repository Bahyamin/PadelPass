import { myBookingsService } from './myBookings.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const myBookingsController = {
  // The player id comes from the login token, never from the request:
  // a player cannot ask for the bookings of somebody else.
  async list(req, res) {
    res.json(await myBookingsService.list(req.user.id));
  },
};
