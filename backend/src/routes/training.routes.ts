import { Router } from 'express';
import { getTrainings, getTrainingById, createTraining, updateTraining } from '../controllers/training.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getTrainings);
router.get('/:id', getTrainingById);
router.post('/', authorize('admin', 'manager', 'engineer'), createTraining);
router.put('/:id', authorize('admin', 'manager', 'engineer'), updateTraining);
export default router;
