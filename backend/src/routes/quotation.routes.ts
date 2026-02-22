import { Router } from 'express';
import { getQuotations, createQuotation, updateQuotationStatus } from '../controllers/quotation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'sales', 'hr_finance'), getQuotations);
router.post('/', authorize('admin', 'sales'), createQuotation);
router.patch('/:id/status', authorize('admin', 'sales'), updateQuotationStatus);
export default router;
