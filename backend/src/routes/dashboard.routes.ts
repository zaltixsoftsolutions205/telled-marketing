import { Router } from 'express';
import { getAdminDashboard, getSalesDashboard, getEngineerDashboard, getHRDashboard } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/admin',    authorize('admin', 'manager'),                    getAdminDashboard);
router.get('/sales',    authorize('admin', 'manager', 'sales'),           getSalesDashboard);
router.get('/engineer', authorize('admin', 'manager', 'engineer'),        getEngineerDashboard);
router.get('/hr',       authorize('admin', 'manager', 'hr'),               getHRDashboard);
export default router;
