import { Router } from 'express';
import { getVisits, createVisit, approveVisit } from '../controllers/engineerVisit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getVisits);
router.post('/', authorize('admin', 'engineer'), createVisit);
router.patch('/:id/approve', authorize('admin', 'hr_finance'), approveVisit);
export default router;
