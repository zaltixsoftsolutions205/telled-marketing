import { Response } from 'express';
import Lead from '../models/Lead';
import Account from '../models/Account';
import Invoice from '../models/Invoice';
import Installation from '../models/Installation';
import SupportTicket from '../models/SupportTicket';
import Quotation from '../models/Quotation';
import PurchaseOrder from '../models/PurchaseOrder';
import Salary from '../models/Salary';
import EngineerVisit from '../models/EngineerVisit';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import mongoose from 'mongoose';

// ── Admin Dashboard ────────────────────────────────────────────────────────
export const getAdminDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);

    const [
      totalLeads, newLeads, convertedLeads,
      totalAccounts, activeAccounts,
      paidInvoices, pendingInvoiceCount, overdueInvoiceCount,
      openTickets, criticalTickets, resolvedTickets,
      leadsByStage, recentLeads,
      pendingDRFs, approvedDRFs, expiringSoonDRFs,
      revenueAgg,
      totalInstalls, scheduledInstalls, inProgressInstalls, completedInstalls,
      installsByEngineer,
    ] = await Promise.all([
      Lead.countDocuments({ organizationId: orgId, isArchived: false }),
      Lead.countDocuments({ organizationId: orgId, isArchived: false, status: 'New' }),
      Lead.countDocuments({ organizationId: orgId, stage: 'Converted' }),
      Account.countDocuments({ organizationId: orgId }),
      Account.countDocuments({ organizationId: orgId, status: 'Active' }),
      Invoice.aggregate([{ $match: { organizationId: orgId, status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Invoice.countDocuments({ organizationId: orgId, status: { $in: ['Sent', 'Partially Paid', 'Overdue'] } }),
      Invoice.countDocuments({ organizationId: orgId, status: 'Overdue' }),
      SupportTicket.countDocuments({ organizationId: orgId, status: { $in: ['Open', 'In Progress'] }, isArchived: false }),
      SupportTicket.countDocuments({ organizationId: orgId, priority: 'Critical', status: { $in: ['Open', 'In Progress'] } }),
      SupportTicket.countDocuments({ organizationId: orgId, status: { $in: ['Resolved', 'Closed'] }, isArchived: false }),
      Lead.aggregate([
        { $match: { organizationId: orgId, isArchived: false } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $project: { stage: '$_id', count: 1, _id: 0 } },
      ]),
      Lead.find({ organizationId: orgId, isArchived: false }).populate('assignedTo', 'name email').sort({ createdAt: -1 }).limit(5).lean(),
      OEMApprovalAttempt.countDocuments({ organizationId: orgId, status: 'Pending' }),
      OEMApprovalAttempt.countDocuments({ organizationId: orgId, status: 'Approved' }),
      OEMApprovalAttempt.countDocuments({
        organizationId: orgId,
        status: 'Approved',
        expiryDate: { $lte: new Date(Date.now() + 30 * 86400000), $gte: new Date() },
      }),
      Invoice.aggregate([
        { $match: { organizationId: orgId, status: 'Paid' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$paidAmount' } } },
        { $sort: { _id: -1 } },
        { $limit: 6 },
        { $project: { month: '$_id', revenue: 1, _id: 0 } },
      ]),
      Installation.countDocuments({ organizationId: orgId }),
      Installation.countDocuments({ organizationId: orgId, status: 'Scheduled' }),
      Installation.countDocuments({ organizationId: orgId, status: 'In Progress' }),
      Installation.countDocuments({ organizationId: orgId, status: 'Completed' }),
      Installation.aggregate([
        { $match: { organizationId: orgId } },
        { $lookup: { from: 'users', localField: 'engineerId', foreignField: '_id', as: 'eng' } },
        { $unwind: { path: '$eng', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$engineerId', engineerName: { $first: '$eng.name' }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }, inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } }, scheduled: { $sum: { $cond: [{ $eq: ['$status', 'Scheduled'] }, 1, 0] } } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    sendSuccess(res, {
      leads:    { total: totalLeads, new: newLeads, converted: convertedLeads },
      accounts: { total: totalAccounts, active: activeAccounts },
      invoices: { totalRevenue: paidInvoices[0]?.total || 0, pending: pendingInvoiceCount, overdue: overdueInvoiceCount },
      tickets:  { open: openTickets, critical: criticalTickets, resolved: resolvedTickets },
      drfs:     { pending: pendingDRFs, approved: approvedDRFs, expiringSoon: expiringSoonDRFs },
      installations: { total: totalInstalls, scheduled: scheduledInstalls, inProgress: inProgressInstalls, completed: completedInstalls, pending: scheduledInstalls + inProgressInstalls },
      installsByEngineer,
      leadsByStage,
      recentLeads,
      revenueByMonth: revenueAgg.reverse(),
    });
  } catch (e) { console.error(e); sendError(res, 'Failed to get dashboard', 500); }
};

// ── Sales Dashboard ────────────────────────────────────────────────────────
export const getSalesDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const orgId  = new mongoose.Types.ObjectId(req.user!.organizationId);

    const [allMyLeads, allAccounts, allQuotations, allPOs, allOrgPOs, recentLeads] = await Promise.all([
      Lead.find({ organizationId: orgId, assignedTo: userId, isArchived: false }).lean(),
      Account.find({ organizationId: orgId, assignedSales: userId }).lean(),
      Quotation.find({ organizationId: orgId, createdBy: userId }).lean(),
      PurchaseOrder.find({ organizationId: orgId, uploadedBy: userId }).lean(),
      PurchaseOrder.find({ organizationId: orgId }).populate('uploadedBy', 'name').lean(),
      Lead.find({ organizationId: orgId, assignedTo: userId, isArchived: false }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const myLeadCounts = {
      total:     allMyLeads.length,
      new:       allMyLeads.filter((l: any) => l.status === 'New').length,
      contacted: allMyLeads.filter((l: any) => l.status === 'Contacted').length,
      qualified: allMyLeads.filter((l: any) => l.status === 'Qualified').length,
      converted: allMyLeads.filter((l: any) => l.stage === 'Converted').length,
      lost:      allMyLeads.filter((l: any) => l.stage === 'Lost').length,
    };

    const stageMap: Record<string, number> = {};
    allMyLeads.forEach((l: any) => { stageMap[l.stage] = (stageMap[l.stage] || 0) + 1; });
    const pipeline = Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));

    const funnel = [
      { stage: 'Leads',      count: allMyLeads.length },
      { stage: 'Qualified',  count: allMyLeads.filter((l: any) => l.status === 'Qualified').length },
      { stage: 'Quotations', count: allQuotations.length },
      { stage: 'POs',        count: allPOs.length },
      { stage: 'Converted',  count: allMyLeads.filter((l: any) => l.stage === 'Converted').length },
    ];

    const leaderMap: Record<string, { name: string; revenue: number; deals: number }> = {};
    allOrgPOs.forEach((po: any) => {
      const uid = po.uploadedBy?._id?.toString() || 'unknown';
      if (!leaderMap[uid]) leaderMap[uid] = { name: po.uploadedBy?.name || 'Unknown', revenue: 0, deals: 0 };
      leaderMap[uid].revenue += po.amount || 0;
      leaderMap[uid].deals += 1;
    });
    const salesLeaderboard = Object.entries(leaderMap)
      .map(([uid, d]) => ({ userId: uid, ...d }))
      .sort((a, b) => b.revenue - a.revenue);
    const myRank = salesLeaderboard.findIndex(e => e.userId === req.user!.id) + 1;

    const alerts: Array<{ type: string; message: string; severity: string }> = [];
    const staleLeads = allMyLeads.filter((l: any) => {
      const days = (Date.now() - new Date(l.updatedAt).getTime()) / 86400000;
      return days > 30 && !['Converted', 'Lost'].includes(l.stage);
    });
    if (staleLeads.length) alerts.push({ type: 'stale', message: `${staleLeads.length} lead(s) have had no activity for 30+ days`, severity: 'warning' });
    if (myLeadCounts.lost) alerts.push({ type: 'lost', message: `${myLeadCounts.lost} lead(s) marked as Lost`, severity: 'info' });

    sendSuccess(res, {
      myLeads: myLeadCounts,
      accounts: { total: allAccounts.length, active: allAccounts.filter((a: any) => a.status === 'Active').length },
      quotations: { total: allQuotations.length, totalValue: allQuotations.reduce((s: number, q: any) => s + (q.total || 0), 0), accepted: allQuotations.filter((q: any) => q.status === 'Accepted').length },
      purchaseOrders: { total: allPOs.length, totalValue: allPOs.reduce((s: number, p: any) => s + (p.amount || 0), 0) },
      pipeline,
      funnel,
      salesLeaderboard,
      myRank: myRank || null,
      alerts,
      conversionRate: allMyLeads.length ? Math.round((myLeadCounts.converted / allMyLeads.length) * 100) : 0,
      drfApprovalRate: 0,
      leadsInNegotiation: allMyLeads.filter((l: any) => l.stage === 'Negotiation').length,
      recentLeads,
    });
  } catch (e) { console.error(e); sendError(res, 'Failed to get sales dashboard', 500); }
};

// ── Engineer Dashboard ─────────────────────────────────────────────────────
export const getEngineerDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);

    const [
      totalAccounts, activeAccounts,
      openTickets, criticalTickets, resolvedTickets,
      scheduledInstalls, inProgressInstalls,
      myVisits, pendingVisits,
      recentInstallations, recentTickets, recentVisits,
    ] = await Promise.all([
      Account.countDocuments({ isArchived: false, assignedEngineer: userId }),
      Account.countDocuments({ isArchived: false, status: 'Active', assignedEngineer: userId }),
      SupportTicket.countDocuments({ $or: [{ assignedEngineer: userId }, { createdBy: userId }], status: { $in: ['Open', 'In Progress'] } }),
      SupportTicket.countDocuments({ $or: [{ assignedEngineer: userId }, { createdBy: userId }], priority: 'Critical', status: { $in: ['Open', 'In Progress'] } }),
      SupportTicket.countDocuments({ $or: [{ assignedEngineer: userId }, { createdBy: userId }], status: { $in: ['Resolved', 'Closed'] } }),
      Installation.countDocuments({ engineerId: userId, status: 'Scheduled' }),
      Installation.countDocuments({ engineerId: userId, status: 'In Progress' }),
      EngineerVisit.countDocuments({ engineerId: userId }),
      EngineerVisit.countDocuments({ engineerId: userId, hrStatus: 'Pending' }),
      Installation.find({ engineerId: userId }).sort({ scheduledDate: -1 }).limit(5).populate('accountId', 'companyName').lean(),
      SupportTicket.find({ $or: [{ assignedEngineer: userId }, { createdBy: userId }], status: { $in: ['Open', 'In Progress'] } }).sort({ createdAt: -1 }).limit(5).populate('accountId', 'companyName').lean(),
      EngineerVisit.find({ engineerId: userId }).sort({ visitDate: -1 }).limit(5).populate('accountId', 'companyName').lean(),
    ]);

    sendSuccess(res, {
      accounts:      { total: totalAccounts, active: activeAccounts },
      tickets:       { open: openTickets, critical: criticalTickets, resolved: resolvedTickets },
      installations: { scheduled: scheduledInstalls, inProgress: inProgressInstalls, total: scheduledInstalls + inProgressInstalls },
      visits:        { total: myVisits, pending: pendingVisits },
      recentInstallations,
      recentTickets,
      recentVisits,
    });
  } catch (e) { console.error(e); sendError(res, 'Failed to get engineer dashboard', 500); }
};

// ── HR/Finance Dashboard ───────────────────────────────────────────────────
export const getHRDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);

    const [
      paidRevenue, totalInvoices, unpaidCount, overdueCount, partialCount, paidCount,
      totalVisits, pendingVisits, approvedVisits,
      totalSalaries, paidSalaryCount, pendingSalaryCount, paidSalaryTotal,
      allInvoices, recentVisitsList, recentSalaries,
    ] = await Promise.all([
      Invoice.aggregate([{ $match: { organizationId: orgId, status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Invoice.countDocuments({ organizationId: orgId }),
      Invoice.countDocuments({ organizationId: orgId, status: 'Sent' }),
      Invoice.countDocuments({ organizationId: orgId, status: 'Overdue' }),
      Invoice.countDocuments({ organizationId: orgId, status: 'Partially Paid' }),
      Invoice.countDocuments({ organizationId: orgId, status: 'Paid' }),
      EngineerVisit.countDocuments({ organizationId: orgId, isArchived: false }),
      EngineerVisit.countDocuments({ organizationId: orgId, hrStatus: 'Pending', isArchived: false }),
      EngineerVisit.countDocuments({ organizationId: orgId, hrStatus: 'Approved', isArchived: false }),
      Salary.countDocuments({ organizationId: orgId }),
      Salary.countDocuments({ organizationId: orgId, isPaid: true }),
      Salary.countDocuments({ organizationId: orgId, isPaid: false }),
      Salary.aggregate([{ $match: { organizationId: orgId, isPaid: true } }, { $group: { _id: null, total: { $sum: '$finalSalary' } } }]),
      Invoice.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(10).populate('accountId', 'companyName').lean(),
      EngineerVisit.find({ organizationId: orgId, isArchived: false, status: 'Completed' }).sort({ visitDate: -1 }).limit(10).populate('engineerId', 'name').populate('accountId', 'companyName').lean(),
      Salary.find({ organizationId: orgId }).sort({ createdAt: -1 }).limit(10).populate('employeeId', 'name role').lean(),
    ]);

    sendSuccess(res, {
      invoices: { totalRevenue: paidRevenue[0]?.total || 0, total: totalInvoices, unpaid: unpaidCount, overdue: overdueCount, partialPaid: partialCount, paid: paidCount },
      visits:   { total: totalVisits, pending: pendingVisits, approved: approvedVisits },
      salaries: { count: totalSalaries, paid: paidSalaryCount, pending: pendingSalaryCount, totalPaid: paidSalaryTotal[0]?.total || 0 },
      allInvoices,
      pendingVisitsList: recentVisitsList,
      recentSalaries,
    });
  } catch (e) { console.error(e); sendError(res, 'Failed to get HR dashboard', 500); }
};
