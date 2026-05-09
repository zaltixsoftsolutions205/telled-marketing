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

const M365_DOMAINS = (process.env.M365_DOMAINS || '')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

export const detectSmtp = (email: string): { host: string; port: number; secure: boolean } => {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (domain.includes('gmail') || domain === 'googlemail.com')
    return { host: 'smtp.gmail.com', port: 465, secure: true };
  if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live') || domain.includes('msn') || M365_DOMAINS.includes(domain))
    return { host: 'smtp-mail.outlook.com', port: 587, secure: false };
  if (domain.includes('office365'))
    return { host: 'smtp.office365.com', port: 587, secure: false };
  if (domain.includes('yahoo') || domain.includes('ymail'))
    return { host: 'smtp.mail.yahoo.com', port: 465, secure: true };
  if (domain.includes('zoho'))
    return { host: 'smtp.zoho.com', port: 465, secure: true };
  if (domain.includes('icloud') || domain === 'me.com' || domain === 'mac.com')
    return { host: 'smtp.mail.me.com', port: 587, secure: false };
  if (domain.includes('protonmail') || domain.includes('proton.me'))
    return { host: '127.0.0.1', port: 1025, secure: false }; // ProtonMail Bridge
  if (domain.includes('fastmail'))
    return { host: 'smtp.fastmail.com', port: 465, secure: true };
  // Unknown business domain — host is empty, caller must prompt user to select provider
  return { host: '', port: 587, secure: false };
};
