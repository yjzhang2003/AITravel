import { Router } from 'express';

import { itineraryController } from '../controllers/itineraryController.js';

const router = Router();

router.get('/', itineraryController.list);
router.post('/', itineraryController.create);
router.post('/:id/budget', itineraryController.calculateBudget);

export default router;
