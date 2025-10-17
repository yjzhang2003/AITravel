import { voiceService } from '../services/voiceService.js';

export const voiceController = {
  async transcribe(req, res, next) {
    try {
      if (!req.body?.audioBase64) {
        return res.status(400).json({ error: 'audioBase64 is required.' });
      }

      const transcription = await voiceService.transcribe(req.body);
      res.json(transcription);
    } catch (error) {
      next(error);
    }
  }
};
