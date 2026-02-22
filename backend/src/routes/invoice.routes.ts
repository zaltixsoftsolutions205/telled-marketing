import { Router } from 'express';
import { getInvoices, createInvoice, recordPayment, getInvoiceStats, getPaymentsByInvoice } from '../controllers/invoice.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/stats', authorize('admin', 'hr_finance'), getInvoiceStats);
router.get('/', authorize('admin', 'hr_finance'), getInvoices);
router.post('/', authorize('admin', 'hr_finance'), createInvoice);
router.get('/:id/payments', authorize('admin', 'hr_finance'), getPaymentsByInvoice);
router.post('/:id/payments', authorize('admin', 'hr_finance'), recordPayment);
export default router;
