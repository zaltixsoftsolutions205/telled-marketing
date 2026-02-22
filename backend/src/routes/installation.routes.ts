import { Router } from 'express';
import { getInstallations, createInstallation, updateInstallation } from '../controllers/installation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getInstallations);
router.post('/', authorize('admin'), createInstallation);
router.put('/:id', authorize('admin', 'engineer'), updateInstallation);
export default router;
