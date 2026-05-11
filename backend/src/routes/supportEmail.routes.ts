// backend/src/routes/supportEmail.routes.ts
import { Router } from 'express';
import { syncSupportEmailsManually, getEmailSyncStatus, fixUnassignedTickets, backfillAccountEmails } from '../controllers/supportEmail.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);
router.get('/status', getEmailSyncStatus);
router.post('/sync', authorize('admin', 'engineer'), syncSupportEmailsManually);
router.post('/fix-assignments', authorize('admin', 'engineer'), fixUnassignedTickets);
router.post('/backfill-emails', authorize('admin'), backfillAccountEmails);

export default router;