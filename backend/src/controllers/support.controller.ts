import { Response } from 'express';
import SupportTicket from '../models/SupportTicket';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generateTicketId } from '../utils/helpers';
import mongoose from 'mongoose';

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.user!.role === 'engineer') filter.assignedEngineer = req.user!.id;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).populate('accountId', 'companyName').populate('assignedEngineer', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      SupportTicket.countDocuments(filter),
    ]);
    sendPaginated(res, tickets, total, page, limit);
  } catch { sendError(res, 'Failed', 500); }
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await new SupportTicket({ ...req.body, ticketId: generateTicketId(), createdBy: req.user!.id }).save();
    sendSuccess(res, ticket, 'Ticket created', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    Object.assign(ticket, req.body);
    if (['Closed', 'Resolved'].includes(req.body.status)) { ticket.closedAt = new Date(); ticket.closedBy = req.user!.id as unknown as mongoose.Types.ObjectId; }
    ticket.lastResponseAt = new Date();
    await ticket.save();
    sendSuccess(res, ticket, 'Ticket updated');
  } catch { sendError(res, 'Failed', 500); }
};

export const addNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) { sendError(res, 'Ticket not found', 404); return; }
    ticket.internalNotes.push({ note: req.body.note, addedBy: req.user!.id as unknown as mongoose.Types.ObjectId, addedAt: new Date() });
    ticket.lastResponseAt = new Date();
    await ticket.save();
    sendSuccess(res, ticket, 'Note added');
  } catch { sendError(res, 'Failed', 500); }
};
