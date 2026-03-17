import { Router } from 'express';
import { getAttemptsByLead, createAttempt, approveAttempt, rejectAttempt, extendExpiry, reassignDRF } from '../controllers/oem.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/lead/:leadId', authorize('admin', 'sales'), getAttemptsByLead);
router.post('/lead/:leadId', authorize('admin', 'sales'), createAttempt);
router.patch('/:id/approve',   authorize('admin'), approveAttempt);
router.patch('/:id/reject',    authorize('admin'), rejectAttempt);
router.patch('/:id/extend',    authorize('admin'), extendExpiry);
router.patch('/:id/reassign',  authorize('admin'), reassignDRF);   // Admin-only reassignment
export default router;
