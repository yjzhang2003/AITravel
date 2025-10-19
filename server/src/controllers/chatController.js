import { plannerChatService } from '../services/plannerChatService.js';

export const chatController = {
  async converse(req, res, next) {
    try {
      const { messages, userContext, itinerary, itineraryRequest, userId, itineraryId } = req.body ?? {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages is required and must be a non-empty array.' });
      }

      const result = await plannerChatService.converse({
        messages,
        userContext,
        itinerary,
        itineraryRequest,
        userId,
        itineraryId
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
