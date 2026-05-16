// import { Router } from 'express';
// import { getSalaries, calculateSalary, markSalaryPaid, getClaimsPreview, getVisitChargesPreview } from '../controllers/salary.controller';
// import { authenticate } from '../middleware/auth.middleware';
// import { authorize } from '../middleware/role.middleware';

// const router = Router();
// router.use(authenticate);
// router.get('/', getSalaries);
// router.get('/claims-preview', authorize('admin', 'manager', 'hr'), getClaimsPreview);
// router.get('/visits-preview', authorize('admin', 'manager', 'hr'), getVisitChargesPreview);
// router.post('/calculate', authorize('admin', 'manager', 'hr'), calculateSalary);
// router.patch('/:id/mark-paid', authorize('admin', 'manager', 'hr'), markSalaryPaid);
// export default router;
import { Router } from 'express';
import { 
  getSalaries, 
  calculateSalary, 
  bulkCalculateSalaries,
  getPayrollStats,
  exportSalaryRegister,
  markSalaryPaid, 
  getClaimsPreview, 
  getVisitChargesPreview 
} from '../controllers/salary.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);

// GET routes
router.get('/', getSalaries);
router.get('/stats', authorize('admin', 'manager', 'hr', 'finance'), getPayrollStats);
router.get('/export', authorize('admin', 'manager', 'hr', 'finance'), exportSalaryRegister);
router.get('/claims-preview', authorize('admin', 'manager', 'hr'), getClaimsPreview);
router.get('/visits-preview', authorize('admin', 'manager', 'hr'), getVisitChargesPreview);

// POST routes
router.post('/calculate', authorize('admin', 'manager', 'hr'), calculateSalary);
router.post('/bulk-calculate', authorize('admin', 'hr'), bulkCalculateSalaries);

// PATCH routes
router.patch('/:id/mark-paid', authorize('admin', 'manager', 'hr', 'finance'), markSalaryPaid);

export default router;