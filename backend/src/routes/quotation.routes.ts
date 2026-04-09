// routes/quotation.routes.ts
import { Router } from 'express';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  acceptQuotation,
  rejectQuotation,
  finalizeQuotation,
  sendQuotationEmail,
  sendToVendor,
  generateQuotationPDF,
  archiveQuotation,
  deleteQuotation,
  getQuotationStats,
} from '../controllers/quotation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

// Stats endpoint
router.get('/stats', authorize('admin', 'sales', 'hr_finance'), getQuotationStats);

// CRUD endpoints
router.get('/', authorize('admin', 'sales', 'engineer', 'hr_finance'), getQuotations);
router.get('/:id', authorize('admin', 'sales', 'engineer'), getQuotationById);
router.post('/', authorize('admin', 'sales'), createQuotation);
router.put('/:id', authorize('admin', 'sales'), updateQuotation);

// Action endpoints
router.patch('/:id/accept', authorize('admin', 'sales'), acceptQuotation);
router.patch('/:id/reject', authorize('admin', 'sales'), rejectQuotation);
router.patch('/:id/finalize', authorize('admin', 'sales'), finalizeQuotation);
router.post('/:id/send-email', authorize('admin', 'sales'), sendQuotationEmail);
router.post('/:id/send-to-vendor', authorize('admin', 'sales'), sendToVendor);
router.post('/:id/generate-pdf', authorize('admin', 'sales'), generateQuotationPDF);
router.patch('/:id/archive', authorize('admin'), archiveQuotation);
router.delete('/:id', authorize('admin', 'sales'), deleteQuotation);

export default router;