import { Router } from 'express';
import { getUsers, createUser, updateUser, toggleUserStatus, resetPassword } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'hr_finance'), getUsers);
router.post('/', authorize('admin'), createUser);
router.put('/:id', authorize('admin'), updateUser);
router.patch('/:id/toggle-status', authorize('admin'), toggleUserStatus);
router.patch('/:id/reset-password', authorize('admin'), resetPassword);
export default router;
