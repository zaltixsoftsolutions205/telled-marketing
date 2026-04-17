import nodemailer from 'nodemailer';

export const getUserEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.USER_SMTP_HOST,
    port: Number(process.env.USER_SMTP_PORT),
    secure: true, // ✅ VERY IMPORTANT (Hostinger = 465)
    auth: {
      user: process.env.USER_SMTP_USER,
      pass: process.env.USER_SMTP_PASS,
    },
  });
};