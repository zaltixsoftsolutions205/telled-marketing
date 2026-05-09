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
router.post('/', authorize('admin', 'manager', 'engineer'), createVisit);
router.post('/schedule', authorize('admin', 'manager', 'engineer'), scheduleVisit);
router.patch('/:id/approve', authorize('admin', 'manager', 'hr'), approveVisit);
router.patch('/:id/reject', authorize('admin', 'manager', 'hr'), rejectVisit);
router.patch('/:id/complete', authorize('admin', 'manager', 'engineer'), completeVisit);
router.patch('/:id/status', authorize('admin', 'manager', 'engineer'), updateVisitStatus);
export default router;
