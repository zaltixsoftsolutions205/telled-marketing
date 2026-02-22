import { Response } from 'express';
import Lead from '../models/Lead';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Account from '../models/Account';
import Invoice from '../models/Invoice';
import Installation from '../models/Installation';
import SupportTicket from '../models/SupportTicket';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';

export const getAdminDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalLeads, totalAccounts, totalAttempts, approvedAttempts, rejectedAttempts, pendingInstallations, openTickets, revenueData, outstandingData, leadsByStage, salesPerformance, recentLeads, expiringApprovals] = await Promise.all([
      Lead.countDocuments({ isArchived: false }),
      Account.countDocuments({ isArchived: false }),
      OEMApprovalAttempt.countDocuments(),
      OEMApprovalAttempt.countDocuments({ status: 'Approved' }),
      OEMApprovalAttempt.countDocuments({ status: 'Rejected' }),
      Installation.countDocuments({ status: { $in: ['Scheduled', 'In Progress'] } }),
      SupportTicket.countDocuments({ status: { $in: ['Open', 'In Progress'] }, isArchived: false }),
      Invoice.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Invoice.aggregate([{ $match: { status: { $in: ['Sent', 'Partially Paid', 'Overdue'] } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } } } }]),
      Lead.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]),
      Lead.aggregate([
        { $group: { _id: '$assignedSales', totalLeads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$stage', 'Converted'] }, 1, 0] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$u.name', totalLeads: 1, converted: 1, conversionRate: { $round: [{ $multiply: [{ $divide: ['$converted', { $max: ['$totalLeads', 1] }] }, 100] }, 1] } } },
      ]),
      Lead.find({ isArchived: false }).populate('assignedSales', 'name').sort({ createdAt: -1 }).limit(5),
      OEMApprovalAttempt.find({ status: 'Pending', expiryDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }).populate('leadId', 'companyName').sort({ expiryDate: 1 }),
    ]);
    sendSuccess(res, {
      counts: { totalLeads, totalAccounts, totalAttempts, pendingInstallations, openTickets, approvalRate: totalAttempts ? ((approvedAttempts / totalAttempts) * 100).toFixed(1) : '0', avgAttemptsPerLead: totalLeads ? (totalAttempts / totalLeads).toFixed(1) : '0' },
      financial: { totalRevenue: revenueData[0]?.total || 0, outstanding: outstandingData[0]?.total || 0 },
      charts: { leadsByStage, salesPerformance },
      approvalBreakdown: { approved: approvedAttempts, rejected: rejectedAttempts, pending: totalAttempts - approvedAttempts - rejectedAttempts },
      expiringApprovals, recentLeads,
    });
  } catch { sendError(res, 'Failed to get dashboard', 500); }
};

export const getEngineerDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user!.id;
    const [myInstallations, myTickets, myAccounts] = await Promise.all([
      Installation.find({ engineerId: id, status: { $in: ['Scheduled', 'In Progress'] } }).populate('accountId', 'companyName').sort({ scheduledDate: 1 }).limit(10),
      SupportTicket.find({ assignedEngineer: id, status: { $in: ['Open', 'In Progress'] } }).populate('accountId', 'companyName').sort({ createdAt: -1 }).limit(10),
      Account.countDocuments({ assignedEngineer: id, isArchived: false }),
    ]);
    sendSuccess(res, { myInstallations, myTickets, myAccounts });
  } catch { sendError(res, 'Failed', 500); }
};
