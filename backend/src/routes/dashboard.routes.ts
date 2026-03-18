import { Router } from 'express';
import { getAdminDashboard, getSalesDashboard, getEngineerDashboard, getHRDashboard } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/admin',    authorize('admin'),                    getAdminDashboard);
router.get('/sales',    authorize('admin', 'sales'),           getSalesDashboard);
router.get('/engineer', authorize('admin', 'engineer'),        getEngineerDashboard);
router.get('/hr',       authorize('admin', 'hr_finance'),      getHRDashboard);
export default router;
