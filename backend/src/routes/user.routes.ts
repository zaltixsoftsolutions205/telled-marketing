import { Router } from 'express';
import { getUsers, createUser, updateUser, toggleUserStatus, resetPassword, deleteUser, updateEmailConfig, updateMyProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin', 'manager', 'hr', 'finance', 'sales', 'engineer'), getUsers);
router.post('/', authorize('admin', 'manager', 'hr'), createUser);
router.put('/:id', updateMyProfile);   // self, admin, manager or hr
router.patch('/:id/toggle-status', authorize('admin', 'manager', 'hr'), toggleUserStatus);
router.patch('/:id/reset-password', authorize('admin', 'manager', 'hr'), resetPassword);
router.delete('/:id', authorize('admin', 'manager', 'hr'), deleteUser);
router.put('/me/email-config', updateEmailConfig);
export default router;
