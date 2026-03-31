import Otp from '../models/Otp';

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const saveOTP = async (email: string, otp: string) => {
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await Otp.findOneAndUpdate(
    { email },
    { otp, expiresAt: expiry },
    { upsert: true, new: true }
  );
};

export const verifyOTP = async (email: string, otp: string): Promise<boolean> => {
  const record = await Otp.findOne({ email });

  if (!record) return false;
  if (record.otp !== otp) return false;
  if (record.expiresAt < new Date()) return false;

  await Otp.deleteOne({ email }); // one-time use
  return true;
};