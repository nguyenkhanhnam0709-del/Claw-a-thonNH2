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
export declare function sendEmailSimple(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
export declare function sendEmailAdvanced(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
declare const _default: {
    sendEmailSimple: typeof sendEmailSimple;
    sendEmailAdvanced: typeof sendEmailAdvanced;
};
export default _default;
