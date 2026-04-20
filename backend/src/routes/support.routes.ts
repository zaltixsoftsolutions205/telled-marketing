import { Router } from 'express';
import { getTickets, createTicket, updateTicket, addNote, resolveTicket, submitFeedback, reopenTicket } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);
router.get('/', getTickets);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.post('/:id/notes', addNote);
router.post('/:id/resolve', resolveTicket);
router.post('/:id/feedback', submitFeedback);
router.post('/:id/reopen', reopenTicket);
export default router;
