import { Router } from 'express';
import { getUsers, createUser, activateUser, updateUser, toggleUserStatus, resetPassword, deleteUser, updateEmailConfig, updateMyProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id/activate', activateUser);
router.put('/:id', updateMyProfile);
router.patch('/:id/toggle-status', authorize('admin', 'manager', 'hr'), toggleUserStatus);
router.patch('/:id/reset-password', authorize('admin', 'manager', 'hr'), resetPassword);
router.delete('/:id', authorize('admin', 'manager', 'hr'), deleteUser);
router.put('/me/email-config', updateEmailConfig);
export default router;
