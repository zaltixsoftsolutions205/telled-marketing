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
  parsePdfQuotation,
} from '../controllers/quotation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// Stats endpoint
router.get('/stats', authorize('admin', 'manager', 'sales', 'hr', 'finance'), getQuotationStats);

// PDF parse endpoint (must be before /:id)
router.post('/parse-pdf', authorize('admin', 'manager', 'sales'), upload.single('file'), parsePdfQuotation);

// CRUD endpoints
router.get('/', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), getQuotations);
router.get('/:id', authorize('admin', 'manager', 'sales', 'engineer'), getQuotationById);
router.post('/', authorize('admin', 'manager', 'sales'), upload.fields([
  { name: 'quotationFile', maxCount: 1 },
  { name: 'sellerLogo',    maxCount: 1 },
  { name: 'secondLogo',    maxCount: 1 },
]), createQuotation);
router.put('/:id', authorize('admin', 'manager', 'sales'), updateQuotation);

// Action endpoints
router.patch('/:id/accept', authorize('admin', 'manager', 'sales'), acceptQuotation);
router.patch('/:id/reject', authorize('admin', 'manager', 'sales'), rejectQuotation);
router.patch('/:id/finalize', authorize('admin', 'manager', 'sales'), finalizeQuotation);
router.post('/:id/send-email', authorize('admin', 'manager', 'sales'), sendQuotationEmail);
router.post('/:id/send-to-vendor', authorize('admin', 'manager', 'sales'), sendToVendor);
router.post('/:id/generate-pdf', authorize('admin', 'manager', 'sales'), generateQuotationPDF);
router.patch('/:id/archive', authorize('admin', 'manager'), archiveQuotation);
router.delete('/:id', authorize('admin', 'manager', 'sales'), deleteQuotation);

export default router;