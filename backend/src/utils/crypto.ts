import crypto from 'crypto';

const KEY = Buffer.from((process.env.ENCRYPTION_KEY || 'telled-smtp-key-32chars-padded!!').padEnd(32).slice(0, 32));
const IV_LEN = 16;

export const encryptText = (text: string): string => {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decryptText = (text: string): string => {
  const [ivHex, encHex] = text.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
};

export const detectSmtp = (email: string): { host: string; port: number; secure: boolean } => {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (domain.includes('gmail'))
    return { host: 'smtp.gmail.com', port: 587, secure: false };
  if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('office365') || domain.includes('live'))
    return { host: 'smtp.office365.com', port: 587, secure: false };
  if (domain.includes('yahoo'))
    return { host: 'smtp.mail.yahoo.com', port: 465, secure: true };
  if (domain.includes('zoho'))
    return { host: 'smtp.zoho.com', port: 465, secure: true };
  // Custom domain — default to Hostinger SMTP
  return { host: 'smtp.hostinger.com', port: 465, secure: true };
};
