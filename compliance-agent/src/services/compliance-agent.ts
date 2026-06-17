import { getData, Template, ResponseFormat } from './excel-loader';
import { sendEmailAdvanced } from './email';

// Types for decision records
export interface DecisionRecord {
  merchantName: string;
  phaseNumber: number;
  decision: 'approve' | 'reject' | 'request_info';
  reason?: string;
  notes?: string;
  documents: string[];
  decidedBy: string;
  decidedAt: string;
  requestFrom?: string;
  requestTime?: string;
}

// In-memory storage for decisions (in production, use database)
const decisions: DecisionRecord[] = [];

// Pending requests queue
const pendingRequests: DecisionRecord[] = [];

// Get all approval phases
export function getApprovalPhases() {
  const data = getData();
  return data.approvalPhases;
}

// Get phase by number
export function getPhaseByNumber(phaseNumber: number) {
  const phases = getApprovalPhases();
  return phases.find(p => p.phaseNumber === phaseNumber);
}

// Get all review criteria for a phase
export function getReviewCriteria(phaseNumber: number) {
  const data = getData();
  return data.reviewCriteria.filter(c => c.phase === phaseNumber);
}

// Get template by name
export function getTemplateByName(templateName: string): Template | undefined {
  const data = getData();
  return data.templates.find(t => t.templateName === templateName);
}

// Get template by type
export function getTemplateByType(templateType: string): Template | undefined {
  const data = getData();
  return data.templates.find(t => t.templateType === templateType);
}

// Get response format
export function getResponseFormat(responseType: string): ResponseFormat | undefined {
  const data = getData();
  return data.responseFormats.find(r => r.responseType === responseType);
}

// Detect command from message
export function detectCommand(message: string): string | undefined {
  const data = getData();
  const msgLower = message.toLowerCase();

  for (const cmd of data.commands) {
    const keywords = cmd.keywords.split(',').map(k => k.trim());
    for (const keyword of keywords) {
      if (msgLower.includes(keyword.toLowerCase())) {
        return cmd.command;
      }
    }
  }

  return undefined;
}

// Extract merchant name from message
export function extractMerchantName(message: string): string | undefined {
  const patterns = [
    /(?:merchant|mc|công ty|danh sách)[:\s]+([A-Za-zÀ-ỹ\s\d]+?)(?:\s|$|,)/i,
    /(?:cho|approve|reject|review)[:\s]+([A-Za-zÀ-ỹ\s\d]+?)(?:\s|$|,|$)/i,
    /([A-Z][A-Za-zÀ-ỹ\s\d]+)(?:\s+giai|\s+phase|\s+đoạn|$)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Extract phase number from message
export function extractPhaseNumber(message: string): number | undefined {
  const patterns = [
    /(?:phase|giai\s*đoạn)[:\s]*(\d+)/i,
    /(?:giai\s*đoạn)\s+(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }

  return 1; // Default to phase 1
}

// Extract rejection reason
export function extractRejectionReason(message: string): string | undefined {
  const patterns = [
    /reject[:\s]+.+?(?:vì|ly\s*do|lý\s*do)[:\s]*(.+)/i,
    /từ\s*chối[:\s]+.+?(?:vì|ly\s*do)[:\s]*(.+)/i,
    /không\s*duyệt[:\s]+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

// Add request to pending queue
export function addPendingRequest(request: DecisionRecord) {
  pendingRequests.push(request);
}

// Get pending requests
export function getPendingRequests(): DecisionRecord[] {
  return pendingRequests;
}

// Remove from pending queue
export function removePendingRequest(merchantName: string) {
  const index = pendingRequests.findIndex(r => r.merchantName.toLowerCase() === merchantName.toLowerCase());
  if (index > -1) {
    pendingRequests.splice(index, 1);
  }
}

// Save decision
export function saveDecision(decision: DecisionRecord) {
  decisions.push(decision);
}

// Get decision history for merchant
export function getDecisionHistory(merchantName: string): DecisionRecord[] {
  return decisions.filter(d => d.merchantName.toLowerCase() === merchantName.toLowerCase());
}

// Get all decisions
export function getAllDecisions(): DecisionRecord[] {
  return decisions;
}

// Approve merchant
export async function approveMerchant(merchantName: string, phaseNumber: number, notes?: string): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
  const phase = getPhaseByNumber(phaseNumber);
  const template = getTemplateByName('email_approve');

  if (!phase) {
    return { success: false, message: 'Phase không tồn tại' };
  }

  // Save decision
  const decision: DecisionRecord = {
    merchantName,
    phaseNumber,
    decision: 'approve',
    notes,
    documents: [],
    decidedBy: phase.pic,
    decidedAt: new Date().toISOString()
  };
  // Get requestFrom before removing
  const pendingReq = pendingRequests.find(r => r.merchantName.toLowerCase() === merchantName.toLowerCase());
  const requestFromEmail = pendingReq?.requestFrom || 'quochung.ng4801.work@gmail.com';

  console.log(`📧 Approve - sending email to: ${requestFromEmail}, template: ${template?.templateName}`);

  decision.requestFrom = requestFromEmail;
  saveDecision(decision);
  removePendingRequest(merchantName);

  // Send email to Biz (PIC who requested)
  let emailSent = false;
  if (template) {
    const body = template.body
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString())
      .replace(/{{approvedDate}}/g, new Date().toLocaleDateString('vi-VN'))
      .replace(/{{notes}}/g, notes || '');

    const subject = template.subject
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString());

    const result = await sendEmailAdvanced({
      to: requestFromEmail,
      subject,
      body,
      isHTML: template.isHTML
    });

    emailSent = result.success;
  }

  return {
    success: true,
    message: `✅ Đã duyệt merchant ${merchantName} - Phase ${phaseNumber}`,
    emailSent
  };
}

// Reject merchant
export async function rejectMerchant(merchantName: string, phaseNumber: number, reason: string, requiredDocuments?: string[]): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
  const phase = getPhaseByNumber(phaseNumber);
  const template = getTemplateByName('email_reject');

  if (!phase) {
    return { success: false, message: 'Phase không tồn tại' };
  }

  // Save decision
  const decision: DecisionRecord = {
    merchantName,
    phaseNumber,
    decision: 'reject',
    reason,
    documents: requiredDocuments || [],
    decidedBy: phase.pic,
    decidedAt: new Date().toISOString()
  };

  // Get requestFrom before removing
  const pendingReqReject = pendingRequests.find(r => r.merchantName.toLowerCase() === merchantName.toLowerCase());
  const requestFromEmailReject = pendingReqReject?.requestFrom || 'quochung.ng4801.work@gmail.com';

  console.log(`📧 Reject - sending email to: ${requestFromEmailReject}, template: ${template?.templateName}`);

  decision.requestFrom = requestFromEmailReject;
  saveDecision(decision);
  removePendingRequest(merchantName);

  // Send email to Biz (PIC who requested)
  let emailSent = false;
  if (template) {
    const body = template.body
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString())
      .replace(/{{rejectedDate}}/g, new Date().toLocaleDateString('vi-VN'))
      .replace(/{{rejectionReason}}/g, reason)
      .replace(/{{requiredDocuments}}/g, requiredDocuments?.join(', ') || '');

    const subject = template.subject
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString());

    const result = await sendEmailAdvanced({
      to: requestFromEmailReject,
      subject,
      body,
      isHTML: template.isHTML
    });

    emailSent = result.success;
  }

  return {
    success: true,
    message: `❌ Đã từ chối merchant ${merchantName} - Phase ${phaseNumber}`,
    emailSent
  };
}

// Request more info
export async function requestMoreInfo(merchantName: string, phaseNumber: number, missingInfo: string[], message?: string): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
  const phase = getPhaseByNumber(phaseNumber);
  const template = getTemplateByName('email_request_info');

  if (!phase) {
    return { success: false, message: 'Phase không tồn tại' };
  }

  // Save decision
  const decision: DecisionRecord = {
    merchantName,
    phaseNumber,
    decision: 'request_info',
    reason: 'Yêu cầu bổ sung thông tin',
    notes: missingInfo.join(', '),
    documents: missingInfo,
    decidedBy: phase.pic,
    decidedAt: new Date().toISOString()
  };

  // Get requestFrom before removing
  const pendingReqInfo = pendingRequests.find(r => r.merchantName.toLowerCase() === merchantName.toLowerCase());
  const requestFromEmailInfo = pendingReqInfo?.requestFrom || 'quochung.ng4801.work@gmail.com';

  console.log(`📧 Request Info - sending email to: ${requestFromEmailInfo}, template: ${template?.templateName}`);

  decision.requestFrom = requestFromEmailInfo;
  saveDecision(decision);
  removePendingRequest(merchantName);

  // Send email to Biz (PIC who requested)
  let emailSent = false;
  if (template) {
    const body = template.body
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString())
      .replace(/{{missingInfo}}/g, missingInfo.map(i => `<li>${i}</li>`).join(''))
      .replace(/{{requestMessage}}/g, message || '');

    const subject = template.subject
      .replace(/{{merchantName}}/g, merchantName)
      .replace(/{{phaseNumber}}/g, phaseNumber.toString());

    const result = await sendEmailAdvanced({
      to: requestFromEmailInfo,
      subject,
      body,
      isHTML: template.isHTML
    });

    emailSent = result.success;
  }

  return {
    success: true,
    message: `⏳ Đã yêu cầu bổ sung thông tin cho merchant ${merchantName} - Phase ${phaseNumber}`,
    emailSent
  };
}

// Format response using template
export function formatResponse(responseType: string, variables: Record<string, string>): { content: string; format: 'html' | 'text' } | null {
  const responseFormat = getResponseFormat(responseType);
  if (!responseFormat) return null;

  let content = responseFormat.template;

  // Replace simple variables {{key}}
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Clean up Handlebars conditionals
  // Handle {{#if notes}} content {{/if}} - only keep content if notes has value
  content = content.replace(/\{\{#if notes\}\}([\s\S]*?)(?:\{\{notes\}\})?([\s\S]*?)\{\/if\}/g, (match, before, after) => {
    const notesValue = variables['notes'] || '';
    if (notesValue.trim()) {
      return `${before}${notesValue}${after}`;
    }
    return '';
  });

  // Handle {{#if requiredDocuments}} content {{/if}}
  content = content.replace(/\{\{#if requiredDocuments\}\}([\s\S]*?)(?:\{\{requiredDocuments\}\})?([\s\S]*?)\{\/if\}/g, (match, before, after) => {
    const docsValue = variables['requiredDocuments'] || '';
    if (docsValue.trim()) {
      return `${before}${docsValue}${after}`;
    }
    return '';
  });

  // Remove any remaining {{#if ...}} and {{/if}} tags
  content = content
    .replace(/\{\{#if\s+\w+\}\}/g, '')
    .replace(/\{\{\/if\}\}/g, '')
    // Clean up empty lines and extra whitespace
    .replace(/^\s*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return {
    content,
    format: responseFormat.format as 'html' | 'text'
  };
}

export default {
  getApprovalPhases,
  getPhaseByNumber,
  getReviewCriteria,
  getTemplateByName,
  getTemplateByType,
  getResponseFormat,
  detectCommand,
  extractMerchantName,
  extractPhaseNumber,
  extractRejectionReason,
  addPendingRequest,
  getPendingRequests,
  removePendingRequest,
  saveDecision,
  getDecisionHistory,
  getAllDecisions,
  approveMerchant,
  rejectMerchant,
  requestMoreInfo,
  formatResponse
};