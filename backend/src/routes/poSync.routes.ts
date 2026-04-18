import { Router } from 'express';
import { scanEmailsForPOs, importDetectedPO, testImapConnection } from '../controllers/poSync.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);

router.get('/test-connection', authorize('admin', 'sales'), testImapConnection);
router.post('/scan',           authorize('admin', 'sales'), scanEmailsForPOs);
router.post('/import',         authorize('admin', 'sales'), importDetectedPO);

export default router;
