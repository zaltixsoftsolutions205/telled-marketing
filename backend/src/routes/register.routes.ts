import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  registerSendOtp,
  registerVerifyOtp,
  registerSubmit,
  registerStatus,
} from '../controllers/register.controller';
import express from 'express';
import {
  actionApprove,
  actionRejectForm,
  actionRejectSubmit,
} from '../controllers/registerAction.controller';

// Ensure uploads/applications directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'applications');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  },
});

// Accept up to 4 document fields
const docFields = upload.fields([
  { name: 'business_registration', maxCount: 1 },
  { name: 'gst_certificate', maxCount: 1 },
  { name: 'id_proof', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 },
  { name: 'pan_certificate', maxCount: 1 },
  { name: 'incorporation_certificate', maxCount: 1 },
]);

const router = Router();

router.post('/send-otp', registerSendOtp);
router.post('/verify-otp', registerVerifyOtp);
router.post('/submit', docFields, registerSubmit);
router.get('/status', registerStatus);

// ── Email magic-link action endpoints (return HTML, no auth required) ──
// These need to parse URL-encoded form POSTs (from the reject reason form)
router.use('/action', express.urlencoded({ extended: false }));
router.get('/action/approve/:token', actionApprove);
router.get('/action/reject/:token', actionRejectForm);
router.post('/action/reject/:token', actionRejectSubmit);

export default router;
