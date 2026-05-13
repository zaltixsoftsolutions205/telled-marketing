import nodemailer from 'nodemailer';
import { EmailProvider, SendEmailOptions } from './EmailProvider';
import logger from '../../utils/logger';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class SmtpProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth:   { user: config.user, pass: config.pass },
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from:    `"${options.fromName}" <${options.fromEmail}>`,
      to:      options.to,
      subject: options.subject,
      html:    options.html,
      replyTo: options.fromEmail,
      ...(options.cc          ? { cc: options.cc }                   : {}),
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    });
    logger.info(`Email sent via SMTP FROM ${options.fromEmail} to ${options.to}: ${options.subject}`);
  }
}
