import { Response } from 'express';
import VisitClaim from '../models/VisitClaim';
import EngineerVisit from '../models/EngineerVisit';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

export const createClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('=== CREATE CLAIM DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user?.id, req.user?.role);
    
    const { visitId, expenses, notes } = req.body;
    
    if (!visitId) {
      sendError(res, 'visitId is required', 400);
      return;
    }
    
    // Validate visit exists
    const visit = await EngineerVisit.findById(visitId);
    if (!visit) {
      console.log('Visit not found:', visitId);
      sendError(res, 'Visit not found', 404);
      return;
    }
    
    console.log('Found visit:', visit._id, visit.visitType);
    
    // Check if claim already exists
    const existingClaim = await VisitClaim.findOne({ visitId: visitId, isArchived: false });
    if (existingClaim) {
      sendError(res, 'A claim already exists for this visit', 409);
      return;
    }
    
    // Create claim
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const nextClaimNumber = `CLM/${year}/${month}/${String(
      (await VisitClaim.countDocuments({
        createdAt: {
          $gte: new Date(year, new Date().getMonth(), 1),
          $lt: new Date(year, new Date().getMonth() + 1, 1)
        }
      })) + 1
    ).padStart(4, '0')}`;

    const claimData = {
      visitId: visitId, // Keep as string, Mongoose will convert
      engineerId: req.user!.id,
      accountId: visit.accountId,
      claimDate: new Date(),
      claimNumber: nextClaimNumber,
      expenses: expenses.map((exp: any) => ({
        ...exp,
        date: new Date(exp.date), // Ensure date is Date object
        amount: Number(exp.amount)
      })),
      notes: notes || '',
      status: 'draft' as const
    };
    
    console.log('Creating claim with data:', JSON.stringify(claimData, null, 2));
    
    const claim = new VisitClaim(claimData);
    console.log('Claim before save:', claim);
    
    await claim.save();
    
    console.log('Claim saved successfully:', claim._id, claim.claimNumber);
    
    const populated = await claim.populate([
      { path: 'engineerId', select: 'name email' },
      { path: 'accountId', select: 'companyName' },
      { path: 'visitId', select: 'visitType scheduledDate' }
    ]);
    
    sendSuccess(res, populated, 'Claim created successfully', 201);
  } catch (error: any) {
    console.error('Create claim error:', error);
    console.error('Error stack:', error.stack);
    sendError(res, error.message || 'Failed to create claim', 500);
  }
};

export const getClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    
    if (req.user!.role === 'engineer') {
      filter.engineerId = req.user!.id;
    }
    
    const [claims, total] = await Promise.all([
      VisitClaim.find(filter)
        .populate('engineerId', 'name email')
        .populate('accountId', 'companyName')
        .populate('visitId', 'visitType scheduledDate status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VisitClaim.countDocuments(filter),
    ]);
    
    sendPaginated(res, claims, total, page, limit);
  } catch (error) {
    console.error('Get claims error:', error);
    sendError(res, 'Failed to fetch claims', 500);
  }
};

export const submitClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claim = await VisitClaim.findById(req.params.id);
    if (!claim || claim.isArchived) {
      sendError(res, 'Claim not found', 404);
      return;
    }
    
    if (claim.engineerId.toString() !== req.user!.id && req.user!.role !== 'admin') {
      sendError(res, 'Access denied', 403);
      return;
    }
    
    if (claim.status !== 'draft') {
      sendError(res, `Cannot submit claim with status: ${claim.status}`, 400);
      return;
    }
    
    if (claim.expenses.length === 0) {
      sendError(res, 'Cannot submit claim with no expenses', 400);
      return;
    }
    
    claim.status = 'submitted';
    claim.submittedAt = new Date();
    await claim.save();
    
    sendSuccess(res, claim, 'Claim submitted for approval');
  } catch (error) {
    console.error('Submit claim error:', error);
    sendError(res, 'Failed to submit claim', 500);
  }
};

export const approveClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { approvalNotes } = req.body;
    const claim = await VisitClaim.findById(req.params.id);
    
    if (!claim) {
      sendError(res, 'Claim not found', 404);
      return;
    }
    
    if (claim.status !== 'submitted' && claim.status !== 'under_review') {
      sendError(res, `Cannot approve claim with status: ${claim.status}`, 400);
      return;
    }
    
    claim.status = 'approved';
    claim.reviewedBy = req.user!.id as any;
    claim.reviewedAt = new Date();
    claim.approvalNotes = approvalNotes;
    await claim.save();
    
    sendSuccess(res, claim, 'Claim approved');
  } catch (error) {
    console.error('Approve claim error:', error);
    sendError(res, 'Failed to approve claim', 500);
  }
};

export const testClaims = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    sendSuccess(res, { message: 'VisitClaim service is operational' });
  } catch (error) {
    console.error('Test claims error:', error);
    sendError(res, 'Failed to run test endpoint', 500);
  }
};

export const rejectClaim = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason) {
      sendError(res, 'Rejection reason is required', 400);
      return;
    }
    
    const claim = await VisitClaim.findById(req.params.id);
    if (!claim) {
      sendError(res, 'Claim not found', 404);
      return;
    }
    
    if (claim.status !== 'submitted' && claim.status !== 'under_review') {
      sendError(res, `Cannot reject claim with status: ${claim.status}`, 400);
      return;
    }
    
    claim.status = 'rejected';
    claim.rejectionReason = rejectionReason;
    claim.reviewedBy = req.user!.id as any;
    claim.reviewedAt = new Date();
    await claim.save();
    
    sendSuccess(res, claim, 'Claim rejected');
  } catch (error) {
    console.error('Reject claim error:', error);
    sendError(res, 'Failed to reject claim', 500);
  }
};

export const getClaimStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.user!.role === 'engineer') {
      filter.engineerId = req.user!.id;
    }
    
    const stats = await VisitClaim.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const result = {
      draft: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      under_review: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };
    
    stats.forEach(stat => {
      const key = stat._id as keyof typeof result;
      if (result[key]) {
        result[key] = { count: stat.count, amount: stat.totalAmount };
      }
    });
    
    sendSuccess(res, result);
  } catch (error) {
    console.error('Get stats error:', error);
    sendError(res, 'Failed to fetch stats', 500);
  }
};