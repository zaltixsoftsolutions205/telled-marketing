import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';

import connectDB from './config/database';
import { verifyEmailConfig } from './config/email';
import logger from './utils/logger';
import { errorHandler, notFound } from './middleware/error.middleware';
import { startCronJobs } from './cron/jobs';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import leadRoutes from './routes/lead.routes';
import oemRoutes from './routes/oem.routes';
import accountRoutes from './routes/account.routes';
import quotationRoutes from './routes/quotation.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import installationRoutes from './routes/installation.routes';
import supportRoutes from './routes/support.routes';
import invoiceRoutes from './routes/invoice.routes';
import engineerVisitRoutes from './routes/engineer-visit.routes';
import salaryRoutes from './routes/salary.routes';
import trainingRoutes from './routes/training.routes';
import dashboardRoutes from './routes/dashboard.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import supportEmailRoutes from './routes/supportEmail.routes';
import otpRoutes from './routes/otp.routes';


const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: 'Too many requests' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/oem', oemRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/installations', installationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/engineer-visits', engineerVisitRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/support-email', supportEmailRoutes);
app.use('/api/otp', otpRoutes);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await connectDB();
  await verifyEmailConfig();
  startCronJobs();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/health`);
    logger.info(`API: http://localhost:${PORT}/api`);
  });
};

start().catch(e => { logger.error('Startup failed:', e); process.exit(1); });

export default app;
