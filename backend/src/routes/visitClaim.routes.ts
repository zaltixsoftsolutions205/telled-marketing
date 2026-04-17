// backend/src/routes/visitClaim.routes.ts
import { Router } from 'express';
import {
  getClaims,
  createClaim,
  submitClaim,
  approveClaim,
  rejectClaim,
  getClaimStats,
  testClaims
} from '../controllers/visitClaim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.get('/test', testClaims);
router.use(authenticate);

router.get('/', getClaims);
router.get('/stats', getClaimStats);
router.post('/', authorize('admin', 'engineer'), createClaim);
router.patch('/:id/submit', authorize('admin', 'engineer'), submitClaim);
router.patch('/:id/approve', authorize('admin', 'hr_finance'), approveClaim);
router.patch('/:id/reject', authorize('admin', 'hr_finance'), rejectClaim);

export default router;