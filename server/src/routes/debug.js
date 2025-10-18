import { Router } from 'express';

import { getLastRawItinerary } from '../services/llmService.js';

const router = Router();

router.get('/last', (req, res) => {
  const raw = getLastRawItinerary();
  res.json({ raw });
});

export default router;
