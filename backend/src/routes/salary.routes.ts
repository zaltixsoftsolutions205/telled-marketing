import { Router } from 'express';
import { getSalaries, calculateSalary, markSalaryPaid, getClaimsPreview } from '../controllers/salary.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getSalaries);
router.get('/claims-preview', authorize('admin', 'hr_finance'), getClaimsPreview);
router.post('/calculate', authorize('admin', 'hr_finance'), calculateSalary);
router.patch('/:id/mark-paid', authorize('admin', 'hr_finance'), markSalaryPaid);
export default router;
