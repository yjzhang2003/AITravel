import { itineraryService } from '../services/itineraryService.js';

export const itineraryController = {
  async list(req, res, next) {
    try {
      const { userId } = req.query;
      const itineraries = await itineraryService.list({ userId });
      res.json({ itineraries });
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const itinerary = await itineraryService.create(req.body);
      res.status(201).json({ itinerary });
    } catch (error) {
      next(error);
    }
  },

  async calculateBudget(req, res, next) {
    try {
      const { id } = req.params;
      const budget = await itineraryService.calculateBudget({
        itineraryId: id,
        overrides: req.body?.overrides ?? req.body ?? {},
        itinerary: req.body?.itinerary
      });
      res.json({ budget });
    } catch (error) {
      next(error);
    }
  },

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      await itineraryService.remove({ itineraryId: id, userId });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
};
