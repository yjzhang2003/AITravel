import { Router } from 'express';

import { voiceController } from '../controllers/voiceController.js';

const router = Router();

router.post('/transcribe', voiceController.transcribe);

export default router;
