import { Router } from 'express';
import {
  getVisits,
  createVisit,
  approveVisit,
  rejectVisit,
  getVisitById,
  scheduleVisit,
  completeVisit,
  updateVisitStatus,
} from '../controllers/engineerVisit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getVisits);
router.get('/:id', getVisitById);
router.post('/', authorize('admin', 'engineer'), createVisit);
router.post('/schedule', authorize('admin', 'engineer'), scheduleVisit);
router.patch('/:id/approve', authorize('admin', 'hr_finance'), approveVisit);
router.patch('/:id/reject', authorize('admin', 'hr_finance'), rejectVisit);
router.patch('/:id/complete', authorize('admin', 'engineer'), completeVisit);
router.patch('/:id/status', authorize('admin', 'engineer'), updateVisitStatus);
export default router;
