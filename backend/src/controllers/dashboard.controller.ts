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
export const getAdminDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalLeads, newLeads, convertedLeads,
      totalAccounts, activeAccounts,
      paidInvoices, pendingInvoiceCount, overdueInvoiceCount,
      openTickets, criticalTickets, resolvedTickets,
      leadsByStage, recentLeads,
      pendingDRFs, approvedDRFs, expiringSoonDRFs,
      revenueAgg,
    ] = await Promise.all([
      Lead.countDocuments({ isArchived: false }),
      Lead.countDocuments({ isArchived: false, status: 'New' }),
      Lead.countDocuments({ stage: 'Converted' }),
      Account.countDocuments({}),
      Account.countDocuments({ status: 'Active' }),
      Invoice.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Invoice.countDocuments({ status: { $in: ['Sent', 'Partially Paid', 'Overdue'] } }),
      Invoice.countDocuments({ status: 'Overdue' }),
      SupportTicket.countDocuments({ status: { $in: ['Open', 'In Progress'] }, isArchived: false }),
      SupportTicket.countDocuments({ priority: 'Critical', status: { $in: ['Open', 'In Progress'] } }),
      SupportTicket.countDocuments({ status: { $in: ['Resolved', 'Closed'] }, isArchived: false }),
      Lead.aggregate([
        { $match: { isArchived: false } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $project: { stage: '$_id', count: 1, _id: 0 } },
      ]),
      Lead.find({ isArchived: false }).populate('assignedTo', 'name email').sort({ createdAt: -1 }).limit(5).lean(),
      OEMApprovalAttempt.countDocuments({ status: 'Pending' }),
      OEMApprovalAttempt.countDocuments({ status: 'Approved' }),
      OEMApprovalAttempt.countDocuments({
        status: 'Approved',
        expiryDate: { $lte: new Date(Date.now() + 30 * 86400000), $gte: new Date() },
      }),
      Invoice.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$paidAmount' } } },
        { $sort: { _id: -1 } },
        { $limit: 6 },
        { $project: { month: '$_id', revenue: 1, _id: 0 } },
      ]),
    ]);

    sendSuccess(res, {
      leads:    { total: totalLeads, new: newLeads, converted: convertedLeads },
      accounts: { total: totalAccounts, active: activeAccounts },
      invoices: { totalRevenue: paidInvoices[0]?.total || 0, pending: pendingInvoiceCount, overdue: overdueInvoiceCount },
      tickets:  { open: openTickets, critical: criticalTickets, resolved: resolvedTickets },
      drfs:     { pending: pendingDRFs, approved: approvedDRFs, expiringSoon: expiringSoonDRFs },
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

    const [allMyLeads, allAccounts, allQuotations, allPOs, allOrgPOs, recentLeads] = await Promise.all([
      Lead.find({ assignedTo: userId, isArchived: false }).lean(),
      Account.find({ assignedSales: userId }).lean(),
      Quotation.find({ createdBy: userId }).lean(),
      PurchaseOrder.find({ uploadedBy: userId }).lean(),
      PurchaseOrder.find({}).populate('uploadedBy', 'name').lean(),
      Lead.find({ assignedTo: userId, isArchived: false }).sort({ createdAt: -1 }).limit(5).lean(),
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
export const getHRDashboard = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      paidRevenue, totalInvoices, unpaidCount, overdueCount, partialCount, paidCount,
      totalVisits, pendingVisits, approvedVisits,
      totalSalaries, paidSalaryCount, pendingSalaryCount, paidSalaryTotal,
      allInvoices, pendingVisitsList, recentSalaries,
    ] = await Promise.all([
      Invoice.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Invoice.countDocuments({}),
      Invoice.countDocuments({ status: 'Sent' }),
      Invoice.countDocuments({ status: 'Overdue' }),
      Invoice.countDocuments({ status: 'Partially Paid' }),
      Invoice.countDocuments({ status: 'Paid' }),
      EngineerVisit.countDocuments({}),
      EngineerVisit.countDocuments({ hrStatus: 'Pending' }),
      EngineerVisit.countDocuments({ hrStatus: 'Approved' }),
      Salary.countDocuments({}),
      Salary.countDocuments({ isPaid: true }),
      Salary.countDocuments({ isPaid: false }),
      Salary.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: '$finalSalary' } } }]),
      Invoice.find({}).sort({ createdAt: -1 }).limit(10).populate('accountId', 'companyName').lean(),
      EngineerVisit.find({ hrStatus: 'Pending' }).sort({ visitDate: -1 }).limit(10).populate('engineerId', 'name').populate('accountId', 'companyName').lean(),
      Salary.find({}).sort({ createdAt: -1 }).limit(10).populate('employeeId', 'name role').lean(),
    ]);

    sendSuccess(res, {
      invoices: { totalRevenue: paidRevenue[0]?.total || 0, total: totalInvoices, unpaid: unpaidCount, overdue: overdueCount, partialPaid: partialCount, paid: paidCount },
      visits:   { total: totalVisits, pending: pendingVisits, approved: approvedVisits },
      salaries: { count: totalSalaries, paid: paidSalaryCount, pending: pendingSalaryCount, totalPaid: paidSalaryTotal[0]?.total || 0 },
      allInvoices,
      pendingVisitsList,
      recentSalaries,
    });
  } catch (e) { console.error(e); sendError(res, 'Failed to get HR dashboard', 500); }
};
