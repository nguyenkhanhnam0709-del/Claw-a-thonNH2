"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailSimple = sendEmailSimple;
exports.sendEmailAdvanced = sendEmailAdvanced;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Email configuration
const EMAIL_USER = process.env.GMAIL_EMAIL || 'hungnqvng@gmail.com';
const EMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
// Create transporter with App Password
function createTransporter() {
    return nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_APP_PASSWORD
        }
    });
}
// Send simple email
async function sendEmailSimple(options) {
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
    }
    catch (error) {
        console.error('❌ Email send error:', error);
        return { success: false, error: error.message };
    }
}
// Send email with advanced options
async function sendEmailAdvanced(options) {
    return sendEmailSimple(options);
}
exports.default = {
    sendEmailSimple,
    sendEmailAdvanced
};
