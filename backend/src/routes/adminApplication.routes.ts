import { Router } from 'express';
import {
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
} from '../controllers/adminApplication.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication + platform_admin role
router.use(authenticate, authorize('platform_admin'));

router.get('/', listApplications);
router.get('/:id', getApplication);
router.post('/:id/approve', approveApplication);
router.post('/:id/reject', rejectApplication);

export default router;
