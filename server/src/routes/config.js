import { Router } from 'express';

import {
  isLLMConfigured,
  isMapConfigured,
  isSupabaseConfigured,
  isVoiceConfigured
} from '../utils/config.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({
    supabase: isSupabaseConfigured(),
    llm: isLLMConfigured(),
    voice: isVoiceConfigured(),
    map: isMapConfigured()
  });
});

router.get('/map-key', (req, res) => {
  if (!isMapConfigured()) {
    return res.status(404).json({ error: 'Map key not configured' });
  }

  res.json({ mapKey: process.env.AMAP_API_KEY });
});

export default router;
