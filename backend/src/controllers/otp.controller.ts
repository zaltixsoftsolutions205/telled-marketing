import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response';
import { generateOTP, saveOTP, verifyOTP } from '../services/otp.service';
import { sendOTPEmail } from '../services/email.service';

// SEND OTP — open to anyone (no email whitelist)
export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 'Email is required', 400);
    }

    const otp = generateOTP();
    await saveOTP(email.toLowerCase().trim(), otp);
    await sendOTPEmail(email.toLowerCase().trim(), otp);

    sendSuccess(res, null, 'OTP sent successfully');
  } catch (e) {
    console.error('OTP send error:', e);
    sendError(res, 'Failed to send OTP', 500);
  }
};

// VERIFY OTP
export const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const isValid = await verifyOTP(email?.toLowerCase().trim(), otp);

    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 400);
    }

    sendSuccess(res, null, 'OTP verified');
  } catch {
    sendError(res, 'OTP verification failed', 500);
  }
};
