import { Router } from 'express';
import { getAccounts, getAccountById, convertLeadToAccount, updateAccount, assignEngineer } from '../controllers/account.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/convert', authorize('admin', 'sales', 'engineer', 'hr_finance'), convertLeadToAccount);
router.put('/:id', authorize('admin', 'sales', 'engineer', 'hr_finance'), updateAccount);
router.patch('/:id/assign-engineer', authorize('admin', 'sales', 'engineer', 'hr_finance'), assignEngineer);
export default router;
