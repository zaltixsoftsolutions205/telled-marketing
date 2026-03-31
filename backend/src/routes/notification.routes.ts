import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getNotifications, markRead, markAllRead } from '../controllers/notification.controller';

const router = Router();
router.use(authenticate);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
export default router;
