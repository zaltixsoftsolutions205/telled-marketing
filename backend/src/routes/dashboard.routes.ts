import { Router } from 'express';
import { getAdminDashboard, getEngineerDashboard } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/admin', authorize('admin', 'sales', 'hr_finance'), getAdminDashboard);
router.get('/engineer', authorize('admin', 'engineer'), getEngineerDashboard);
export default router;
