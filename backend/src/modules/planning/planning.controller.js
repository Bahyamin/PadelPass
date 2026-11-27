import { planningService } from './planning.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const planningController = {
  async getDay(req, res) {
    res.json(await planningService.getDay(req.query.date));
  },
};
