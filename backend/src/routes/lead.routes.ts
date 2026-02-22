import { Router } from 'express';
import { getLeads, getLeadById, createLead, updateLead, archiveLead } from '../controllers/lead.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'sales'), getLeads);
router.get('/:id', authorize('admin', 'sales'), getLeadById);
router.post('/', authorize('admin', 'sales'), createLead);
router.put('/:id', authorize('admin', 'sales'), updateLead);
router.patch('/:id/archive', authorize('admin'), archiveLead);
export default router;
