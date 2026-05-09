import { Router } from 'express';
import { getAccounts, getAccountById, convertLeadToAccount, updateAccount, assignEngineer, sendWelcomeMail, deleteAccount } from '../controllers/account.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/convert', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), convertLeadToAccount);
router.put('/:id', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), updateAccount);
router.patch('/:id/assign-engineer', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), assignEngineer);
router.post('/:id/send-welcome', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), sendWelcomeMail);
router.delete('/:id', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), deleteAccount);
export default router;