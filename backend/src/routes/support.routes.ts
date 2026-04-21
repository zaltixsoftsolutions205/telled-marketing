import { Router } from 'express';
import { getTickets, createTicket, updateTicket, addNote, resolveTicket, submitFeedback, reopenTicket, publicFeedback } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public route — no auth — customer feedback via emailed token link
router.post('/public-feedback/:token', publicFeedback);
router.get('/public-feedback/:token', async (req, res) => {
  const ticket = await (await import('../models/SupportTicket')).default.findOne({ feedbackToken: req.params.token }).select('ticketId subject status companyName').lean();
  if (!ticket) { res.status(404).json({ success: false, message: 'Invalid or expired feedback link' }); return; }
  res.json({ success: true, data: ticket });
});

router.use(authenticate);
router.get('/', getTickets);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.post('/:id/notes', addNote);
router.post('/:id/resolve', resolveTicket);
router.post('/:id/feedback', submitFeedback);
router.post('/:id/reopen', reopenTicket);
export default router;
