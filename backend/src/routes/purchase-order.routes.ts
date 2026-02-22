import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import PurchaseOrder from '../models/PurchaseOrder';
import Account from '../models/Account';
import Lead from '../models/Lead';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generatePONumber } from '../utils/helpers';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { page, limit, skip } = getPaginationParams(req);
  const filter: Record<string, unknown> = { isArchived: false };
  if (req.query.accountId) filter.accountId = req.query.accountId;
  const [pos, total] = await Promise.all([
    PurchaseOrder.find(filter).populate('accountId', 'companyName').populate('uploadedBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);
  sendPaginated(res, pos, total, page, limit);
});

router.post('/', authorize('admin', 'sales'), upload.single('poDocument'), async (req: AuthRequest, res: Response) => {
  try {
    const data = { ...req.body, poNumber: req.body.poNumber || generatePONumber(), uploadedBy: req.user!.id };
    if (req.file) data.poDocument = req.file.filename;
    const po = await new PurchaseOrder(data).save();
    const account = await Account.findById(req.body.accountId);
    if (account) await Lead.findByIdAndUpdate(account.leadId, { stage: 'PO Received' });
    sendSuccess(res, po, 'PO uploaded', 201);
  } catch (e) { sendError(res, 'Failed to upload PO', 500); }
});

export default router;
