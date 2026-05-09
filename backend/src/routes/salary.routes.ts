import { Router } from 'express';
import { getSalaries, calculateSalary, markSalaryPaid, getClaimsPreview, getVisitChargesPreview } from '../controllers/salary.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getSalaries);
router.get('/claims-preview', authorize('admin', 'manager', 'hr'), getClaimsPreview);
router.get('/visits-preview', authorize('admin', 'manager', 'hr'), getVisitChargesPreview);
router.post('/calculate', authorize('admin', 'manager', 'hr'), calculateSalary);
router.patch('/:id/mark-paid', authorize('admin', 'manager', 'hr'), markSalaryPaid);
export default router;
