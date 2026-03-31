import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response';
import { generateOTP, saveOTP, verifyOTP } from '../services/otp.service';
import { sendOTPEmail } from '../services/email.service';

const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase());

// SEND OTP
export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 'Email is required', 400);
    }

    // 🔐 CHECK ALLOWED EMAIL
    if (!allowedEmails.includes(email.toLowerCase())) {
      return sendError(res, 'This email is not authorized for admin registration', 403);
    }

    const otp = generateOTP();
    await saveOTP(email, otp);
    sendOTPEmail(email, otp);

    sendSuccess(res, null, 'OTP sent successfully');
  } catch (e) {
    sendError(res, 'Failed to send OTP', 500);
  }
};

// VERIFY OTP
export const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const isValid = await verifyOTP(email, otp);

    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 400);
    }

    sendSuccess(res, null, 'OTP verified');
  } catch {
    sendError(res, 'OTP verification failed', 500);
  }
};