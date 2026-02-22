import { Router } from 'express';
import { getAccounts, getAccountById, convertLeadToAccount, updateAccount, assignEngineer } from '../controllers/account.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getAccounts);
router.get('/:id', getAccountById);
router.post('/convert', authorize('admin', 'sales'), convertLeadToAccount);
router.put('/:id', authorize('admin', 'sales'), updateAccount);
router.patch('/:id/assign-engineer', authorize('admin'), assignEngineer);
export default router;
