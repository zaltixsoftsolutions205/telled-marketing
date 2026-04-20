// backend/src/routes/visitClaim.routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getClaims,
  createClaim,
  submitClaim,
  approveClaim,
  rejectClaim,
  getClaimStats,
  testClaims
} from '../controllers/visitClaim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const uploadDir = path.join(process.cwd(), 'uploads', 'visit-claims');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.get('/test', testClaims);
router.use(authenticate);

router.get('/', getClaims);
router.get('/stats', getClaimStats);
router.post('/', authorize('admin', 'engineer'), createClaim);
router.patch('/:id/submit', authorize('admin', 'engineer'), upload.single('invoiceFile'), submitClaim);
router.patch('/:id/approve', authorize('admin', 'hr_finance'), approveClaim);
router.patch('/:id/reject', authorize('admin', 'hr_finance'), rejectClaim);

export default router;