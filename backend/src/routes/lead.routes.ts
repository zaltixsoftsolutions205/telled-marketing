import { Router } from 'express';
import { getLeads, getLeadById, createLead, updateLead, archiveLead, deleteLead, importLeads, sendDRF } from '../controllers/lead.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'sales'), getLeads);
router.get('/:id', authorize('admin', 'sales'), getLeadById);
router.post('/', authorize('admin', 'sales'), createLead);
router.put('/:id', authorize('admin', 'sales'), updateLead);
router.post('/:id/send-drf', authorize('admin', 'sales'), sendDRF);
router.patch('/:id/archive', authorize('admin'), archiveLead);
router.delete('/:id', authorize('admin', 'sales'), deleteLead);
router.post('/import', authorize('admin', 'sales'), importLeads);
export default router;
