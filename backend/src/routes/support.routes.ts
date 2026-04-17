import { Router } from 'express';
import { getTickets, createTicket, updateTicket, addNote } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getTickets);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.post('/:id/notes', addNote);
export default router;
