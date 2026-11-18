import { courtsService } from './courts.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const courtsController = {
  async listCourts(req, res) {
    res.json(await courtsService.listCourts());
  },

  async getAvailability(req, res) {
    res.json(await courtsService.getAvailability(req.query.date));
  },
};
