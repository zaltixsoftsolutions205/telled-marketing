import { Router } from 'express';
import {
  getQuotations, createQuotation, acceptQuotation, rejectQuotation,
  sendQuotationEmail, generateQuotationPDF,
} from '../controllers/quotation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);

router.get('/',                                   authorize('admin', 'sales', 'hr_finance'), getQuotations);
router.post('/',                                  authorize('admin', 'sales'), createQuotation);
router.patch('/:id/accept',                       authorize('admin', 'sales'), acceptQuotation);
router.patch('/:id/reject',                       authorize('admin', 'sales'), rejectQuotation);
router.post('/:id/send-email',                    authorize('admin', 'sales'), sendQuotationEmail);
router.post('/:id/generate-pdf',                  authorize('admin', 'sales'), generateQuotationPDF);

export default router;
