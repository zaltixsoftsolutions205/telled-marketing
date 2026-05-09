import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import {
  getTimesheets, createTimesheet, updateTimesheet, deleteTimesheet,
  submitTimesheet, approveTimesheet, rejectTimesheet,
} from '../controllers/timesheet.controller';

const router = Router();
router.use(authenticate);

router.get('/',                                           getTimesheets);
router.post('/',                                          createTimesheet);
router.put('/:id',                                        updateTimesheet);
router.delete('/:id',                                     deleteTimesheet);
router.patch('/:id/submit',                               submitTimesheet);
router.patch('/:id/approve', authorize('admin', 'manager', 'hr'),    approveTimesheet);
router.patch('/:id/reject',  authorize('admin', 'manager', 'hr'),    rejectTimesheet);

export default router;
