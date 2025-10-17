import { Router } from 'express';

import { isLLMConfigured, isSupabaseConfigured, isVoiceConfigured } from '../utils/config.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json({
    supabase: isSupabaseConfigured(),
    llm: isLLMConfigured(),
    voice: isVoiceConfigured()
  });
});

export default router;
