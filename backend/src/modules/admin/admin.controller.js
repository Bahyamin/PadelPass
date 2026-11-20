import { adminService } from './admin.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
// req.user is set by the authenticate middleware.
export const adminController = {
  async getOpeningHours(req, res) {
    res.json(await adminService.getOpeningHours());
  },

  async replaceOpeningHours(req, res) {
    res.json(await adminService.replaceOpeningHours(req.user.id, req.body));
  },

  async listPricingRules(req, res) {
    res.json(await adminService.listPricingRules());
  },

  async createPricingRule(req, res) {
    res
      .status(201)
      .json(await adminService.createPricingRule(req.user.id, req.body));
  },

  async updatePricingRule(req, res) {
    res.json(
      await adminService.updatePricingRule(
        req.user.id,
        Number(req.params.id),
        req.body,
      ),
    );
  },

  async deletePricingRule(req, res) {
    await adminService.deletePricingRule(req.user.id, Number(req.params.id));
    res.status(204).end();
  },

  async getSettings(req, res) {
    res.json(await adminService.getSettings());
  },

  async updateSettings(req, res) {
    res.json(await adminService.updateSettings(req.user.id, req.body));
  },
};
