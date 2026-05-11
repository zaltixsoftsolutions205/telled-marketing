// backend/src/controllers/support.controller.ts - Update these functions

import { Response } from 'express';
import crypto from 'crypto';
import SupportTicket from '../models/SupportTicket';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generateTicketId } from '../utils/helpers';
import { sendTicketStatusUpdate, sendTicketAcknowledgement, sendTicketAssignmentNotification, sendFeedbackRequestEmail, sendTicketReopenedEmail, UserSmtpConfig } from '../services/email.service';
import { notifyUser } from '../utils/notify';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import User from '../models/User';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';

const appUrl = () => (process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim() + '/zieos').replace(/\/$/, '');

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId, isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.user!.role === 'engineer') {
      filter.$or = [
        { assignedEngineer: new mongoose.Types.ObjectId(req.user!.id) },
        { createdBy: new mongoose.Types.ObjectId(req.user!.id) },
      ];
    }
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('accountId', 'companyName contactEmail')
        .populate('assignedEngineer', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(filter),
    ]);
    sendPaginated(res, tickets, total, page, limit);
  } catch (error) {
    logger.error('Get tickets error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = { ...req.body };
    if (data.assignedTo && !data.assignedEngineer) {
      data.assignedEngineer = data.assignedTo;
      delete data.assignedTo;
    }
    
    const ticket = await new SupportTicket({
      ...data,
      organizationId: req.user!.organizationId,
      ticketId: generateTicketId(),
      createdBy: req.user!.id
    }).save();
    
    // Populate for email
    const populated = await SupportTicket.findById(ticket._id)
      .populate('assignedEngineer', 'name email')
      .populate('accountId', 'companyName contactEmail');
    
    // Acknowledgement email to customer
    const account = populated?.accountId as any;
    if (account?.contactEmail) {
      const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
      await sendTicketAcknowledgement(
        account.contactEmail, account.companyName || 'Customer', populated!.ticketId, populated!.subject, senderSmtp
      ).catch(e => logger.error('Failed to send acknowledgement email:', e));
    }

    // In-app + email notification to assigned engineer
    if (populated?.assignedEngineer) {
      const engineer = populated.assignedEngineer as any;
      notifyUser(engineer._id?.toString() || engineer.toString(), {
        title: 'New Support Ticket Assigned',
        message: `Ticket ${populated.ticketId}: "${populated.subject}" has been assigned to you`,
        type: 'support',
        link: '/support',
      });
      if (engineer?.email) {
        const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
        await sendTicketAssignmentNotification(
          engineer.email, populated.ticketId, populated.subject, engineer.name, senderSmtp
        ).catch(e => logger.error('Failed to send assignment email:', e));
      }
    }

    sendSuccess(res, ticket, 'Ticket created', 201);
  } catch (error) {
    logger.error('Create ticket error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('accountId', 'companyName contactEmail')
      .populate('assignedEngineer', 'name email')
      .populate('createdBy', 'name email');
      
    if (!ticket) {
      sendError(res, 'Ticket not found', 404);
      return;
    }
    
    const oldStatus = ticket.status;
    const oldAssignee = ticket.assignedEngineer?.toString();

    // Block direct "Closed" — must go through resolve flow
    if (req.body.status === 'Closed') {
      sendError(res, 'Use the Resolve endpoint to close a ticket', 400);
      return;
    }

    // Update ticket
    Object.assign(ticket, req.body);

    if (req.body.status === 'Resolved') {
      ticket.resolvedAt = new Date();
    }
    
    ticket.lastResponseAt = new Date();
    await ticket.save();
    
    // Send email notification if status changed
    if (oldStatus !== ticket.status && ticket.status !== 'Closed') {
      const account = ticket.accountId as any;
      if (account?.contactEmail) {
        const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
        await sendTicketStatusUpdate(
          account.contactEmail, ticket.ticketId, ticket.subject,
          oldStatus, ticket.status, req.user?.name || 'System', req.body.updateNote, senderSmtp, account.companyName || 'Customer'
        ).catch(e => logger.error('Failed to send status update email:', e));
      }
    }
    
    // In-app notify creator of status change
    if (oldStatus !== ticket.status && ticket.createdBy) {
      notifyUser((ticket.createdBy as any)._id?.toString() || ticket.createdBy.toString(), {
        title: 'Ticket Status Updated',
        message: `Ticket ${ticket.ticketId} status changed from ${oldStatus} to ${ticket.status}`,
        type: 'support',
        link: '/support',
      });
    }

    // In-app + email notification to new engineer if assigned
    if (oldAssignee !== ticket.assignedEngineer?.toString() && ticket.assignedEngineer) {
      const engineer = ticket.assignedEngineer as any;
      notifyUser(engineer._id?.toString() || engineer.toString(), {
        title: 'Support Ticket Assigned',
        message: `Ticket ${ticket.ticketId}: "${ticket.subject}" assigned to you`,
        type: 'support',
        link: '/support',
      });
      if (engineer?.email) {
        const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
        await sendTicketAssignmentNotification(
          engineer.email, ticket.ticketId, ticket.subject, engineer.name, senderSmtp
        ).catch(e => logger.error('Failed to send assignment email:', e));
      }
    }
    
    sendSuccess(res, ticket, 'Ticket updated');
  } catch (error) {
    logger.error('Update ticket error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const addNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    ticket.internalNotes.push({ note: req.body.note, addedBy: req.user!.id as unknown as mongoose.Types.ObjectId, addedAt: new Date() });
    ticket.lastResponseAt = new Date();
    await ticket.save();
    sendSuccess(res, ticket, 'Note added');
  } catch (error) {
    logger.error('Add note error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const resolveTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('accountId', 'companyName contactEmail')
      .populate('assignedEngineer', 'name email');
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    if (ticket.status === 'Closed') { sendError(res, 'Ticket already closed', 400); return; }

    const oldStatus = ticket.status;
    ticket.status = 'Resolved';
    ticket.resolvedAt = new Date();
    ticket.resolvedBy = req.body.resolvedBy?.trim() || req.user?.name || '';
    ticket.lastResponseAt = new Date();
    // Generate a unique token for the public feedback form link
    ticket.feedbackToken = crypto.randomBytes(32).toString('hex');
    if (req.body.note) {
      ticket.internalNotes.push({ note: req.body.note, addedBy: req.user!.id as unknown as mongoose.Types.ObjectId, addedAt: new Date() });
    }
    await ticket.save();

    const account = ticket.accountId as any;
    if (account?.contactEmail) {
      const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
      const feedbackUrl = `${appUrl()}/feedback/${ticket.feedbackToken}`;
      // Single email — includes resolved status + feedback request + reply instruction
      await sendFeedbackRequestEmail(account.contactEmail, ticket.ticketId, ticket.subject, account.companyName || 'Customer', senderSmtp, feedbackUrl)
        .catch(e => logger.error('Failed to send feedback request email:', e));
    }

    sendSuccess(res, ticket, 'Ticket marked as resolved. Customer notified to provide feedback.');
  } catch (error) {
    logger.error('Resolve ticket error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const submitFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    if (ticket.status !== 'Resolved') { sendError(res, 'Ticket is not in Resolved state', 400); return; }

    ticket.customerFeedback = req.body.feedback || 'Customer confirmed resolution';
    ticket.customerFeedbackAt = new Date();
    ticket.status = 'Closed';
    ticket.closedAt = new Date();
    ticket.closedBy = req.user!.id as unknown as mongoose.Types.ObjectId;
    ticket.lastResponseAt = new Date();
    await ticket.save();

    sendSuccess(res, ticket, 'Feedback received. Ticket closed.');
  } catch (error) {
    logger.error('Submit feedback error:', error);
    sendError(res, 'Failed', 500);
  }
};

// Public — no auth required. Customer submits feedback via emailed link.
export const publicFeedback = async (req: any, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findOne({ feedbackToken: req.params.token });
    if (!ticket) { sendError(res, 'Invalid or expired feedback link', 404); return; }
    if (ticket.status === 'Closed') { sendSuccess(res, null, 'Feedback already submitted. Ticket is closed.'); return; }
    if (ticket.status !== 'Resolved') { sendError(res, 'Ticket is not ready for feedback', 400); return; }

    ticket.customerFeedback = (req.body.feedback || '').trim() || 'Customer confirmed resolution';
    ticket.customerFeedbackAt = new Date();
    ticket.status = 'Closed';
    ticket.closedAt = new Date();
    ticket.feedbackToken = undefined; // invalidate token after use
    ticket.lastResponseAt = new Date();
    await ticket.save();

    sendSuccess(res, { ticketId: ticket.ticketId }, 'Thank you for your feedback! Ticket has been closed.');
  } catch (error) {
    logger.error('Public feedback error:', error);
    sendError(res, 'Failed', 500);
  }
};

export const reopenTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('accountId', 'companyName contactEmail')
      .populate('assignedEngineer', 'name email');
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    if (ticket.status !== 'Closed') { sendError(res, 'Only closed tickets can be reopened', 400); return; }

    // Check 3-day reopen window
    const REOPEN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
    if (ticket.closedAt && Date.now() - ticket.closedAt.getTime() > REOPEN_WINDOW_MS) {
      sendError(res, 'Reopen window has expired (3 days). Please create a new ticket.', 400);
      return;
    }

    ticket.status = 'Reopened';
    ticket.reopenedAt = new Date();
    ticket.reopenCount = (ticket.reopenCount || 0) + 1;
    ticket.closedAt = undefined;
    ticket.resolvedAt = undefined;
    ticket.customerFeedback = undefined;
    ticket.customerFeedbackAt = undefined;
    ticket.lastResponseAt = new Date();
    if (req.body.reason) {
      ticket.internalNotes.push({ note: `Reopened: ${req.body.reason}`, addedBy: req.user!.id as unknown as mongoose.Types.ObjectId, addedAt: new Date() });
    }
    await ticket.save();

    const account = ticket.accountId as any;
    if (account?.contactEmail) {
      const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
      await sendTicketReopenedEmail(account.contactEmail, ticket.ticketId, ticket.subject, account.companyName || 'Customer', senderSmtp)
        .catch(e => logger.error('Failed to send reopen email:', e));
    }

    sendSuccess(res, ticket, 'Ticket reopened. Will auto-spawn new ticket after 3 days if unresolved.');
  } catch (error) {
    logger.error('Reopen ticket error:', error);
    sendError(res, 'Failed', 500);
  }
};