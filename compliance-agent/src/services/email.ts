import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_USER = process.env.GMAIL_EMAIL || 'hungnqvng@gmail.com';
const EMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
  isHTML?: boolean;
}

// Create transporter with App Password
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD
    }
  });
}

// Send simple email
export async function sendEmailSimple(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Zalopay Compliance" <${EMAIL_USER}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.isHTML ? undefined : options.body,
      html: options.isHTML ? options.body : undefined,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        path: att.path,
        content: att.content,
        contentType: att.contentType
      }))
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Send email with advanced options
export async function sendEmailAdvanced(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmailSimple(options);
}

export default {
  sendEmailSimple,
  sendEmailAdvanced
};