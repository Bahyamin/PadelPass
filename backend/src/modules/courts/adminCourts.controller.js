import { adminCourtsService } from './adminCourts.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
// req.user is set by the authenticate middleware.
export const adminCourtsController = {
  async list(req, res) {
    res.json(await adminCourtsService.list());
  },

  async create(req, res) {
    res
      .status(201)
      .json(await adminCourtsService.create(req.user.id, req.body));
  },

  async update(req, res) {
    res.json(
      await adminCourtsService.update(
        req.user.id,
        Number(req.params.id),
        req.body,
      ),
    );
  },

  async close(req, res) {
    res
      .status(201)
      .json(
        await adminCourtsService.close(
          req.user.id,
          Number(req.params.id),
          req.body,
        ),
      );
  },
};
