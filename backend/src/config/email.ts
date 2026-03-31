import nodemailer from 'nodemailer';
import logger from '../utils/logger';

let transporter: nodemailer.Transporter;

export const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      pool: true,              // ✅ IMPORTANT (connection pooling)
      maxConnections: 5,
      maxMessages: 100
    });
  }

  return transporter;
};

export const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

export const verifyEmailConfig = async (): Promise<void> => {
  try {
    await createTransporter().verify();
    logger.info('Email config verified');
  } catch (e) {
    logger.warn('Email config verification failed (emails will not be sent):', e);
  }
};
