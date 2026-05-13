export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>;
  fromName: string;
  fromEmail: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<void>;
}
