import { Router } from 'express';
import { getLeads, getLeadById, createLead, updateLead, archiveLead, deleteLead, importLeads, sendDRF, sendDRFExtension } from '../controllers/lead.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'manager', 'sales'), getLeads);
router.get('/:id', authorize('admin', 'manager', 'sales'), getLeadById);
router.post('/', authorize('admin', 'manager', 'sales'), createLead);
router.put('/:id', authorize('admin', 'manager', 'sales'), updateLead);
router.post('/:id/send-drf', authorize('admin', 'manager', 'sales'), sendDRF);
router.patch('/:id/archive', authorize('admin', 'manager'), archiveLead);
router.delete('/:id', authorize('admin', 'manager', 'sales'), deleteLead);
router.post('/import', authorize('admin', 'manager', 'sales'), importLeads);
router.post('/drf-extension-email', authorize('admin', 'manager', 'sales'), sendDRFExtension);
export default router;
