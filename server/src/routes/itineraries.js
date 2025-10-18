import { Router } from 'express';

import { itineraryController } from '../controllers/itineraryController.js';
import { chatController } from '../controllers/chatController.js';

const router = Router();

router.get('/', itineraryController.list);
router.post('/', itineraryController.create);
router.post('/chat/converse', chatController.converse);
router.post('/:id/budget', itineraryController.calculateBudget);

export default router;
