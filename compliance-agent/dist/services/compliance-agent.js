"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApprovalPhases = getApprovalPhases;
exports.getPhaseByNumber = getPhaseByNumber;
exports.getReviewCriteria = getReviewCriteria;
exports.getTemplateByName = getTemplateByName;
exports.getTemplateByType = getTemplateByType;
exports.getResponseFormat = getResponseFormat;
exports.detectCommand = detectCommand;
exports.extractMerchantName = extractMerchantName;
exports.extractPhaseNumber = extractPhaseNumber;
exports.extractRejectionReason = extractRejectionReason;
exports.addPendingRequest = addPendingRequest;
exports.getPendingRequests = getPendingRequests;
exports.removePendingRequest = removePendingRequest;
exports.saveDecision = saveDecision;
exports.getDecisionHistory = getDecisionHistory;
exports.getAllDecisions = getAllDecisions;
exports.approveMerchant = approveMerchant;
exports.rejectMerchant = rejectMerchant;
exports.requestMoreInfo = requestMoreInfo;
exports.formatResponse = formatResponse;
const excel_loader_1 = require("./excel-loader");
const email_1 = require("./email");
// In-memory storage for decisions (in production, use database)
const decisions = [];
// Pending requests queue
const pendingRequests = [];
// Get all approval phases
function getApprovalPhases() {
    const data = (0, excel_loader_1.getData)();
    return data.approvalPhases;
}
// Get phase by number
function getPhaseByNumber(phaseNumber) {
    const phases = getApprovalPhases();
    return phases.find(p => p.phaseNumber === phaseNumber);
}
// Get all review criteria for a phase
function getReviewCriteria(phaseNumber) {
    const data = (0, excel_loader_1.getData)();
    return data.reviewCriteria.filter(c => c.phase === phaseNumber);
}
// Get template by name
function getTemplateByName(templateName) {
    const data = (0, excel_loader_1.getData)();
    return data.templates.find(t => t.templateName === templateName);
}
// Get template by type
function getTemplateByType(templateType) {
    const data = (0, excel_loader_1.getData)();
    return data.templates.find(t => t.templateType === templateType);
}
// Get response format
function getResponseFormat(responseType) {
    const data = (0, excel_loader_1.getData)();
    return data.responseFormats.find(r => r.responseType === responseType);
}
// Detect command from message
function detectCommand(message) {
    const data = (0, excel_loader_1.getData)();
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
function extractMerchantName(message) {
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
function extractPhaseNumber(message) {
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
function extractRejectionReason(message) {
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
function addPendingRequest(request) {
    pendingRequests.push(request);
}
// Get pending requests
function getPendingRequests() {
    return pendingRequests;
}
// Remove from pending queue
function removePendingRequest(merchantName) {
    const index = pendingRequests.findIndex(r => r.merchantName.toLowerCase() === merchantName.toLowerCase());
    if (index > -1) {
        pendingRequests.splice(index, 1);
    }
}
// Save decision
function saveDecision(decision) {
    decisions.push(decision);
}
// Get decision history for merchant
function getDecisionHistory(merchantName) {
    return decisions.filter(d => d.merchantName.toLowerCase() === merchantName.toLowerCase());
}
// Get all decisions
function getAllDecisions() {
    return decisions;
}
// Approve merchant
async function approveMerchant(merchantName, phaseNumber, notes) {
    const phase = getPhaseByNumber(phaseNumber);
    const template = getTemplateByName('email_approve');
    if (!phase) {
        return { success: false, message: 'Phase không tồn tại' };
    }
    // Save decision
    const decision = {
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
        const result = await (0, email_1.sendEmailAdvanced)({
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
async function rejectMerchant(merchantName, phaseNumber, reason, requiredDocuments) {
    const phase = getPhaseByNumber(phaseNumber);
    const template = getTemplateByName('email_reject');
    if (!phase) {
        return { success: false, message: 'Phase không tồn tại' };
    }
    // Save decision
    const decision = {
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
        const result = await (0, email_1.sendEmailAdvanced)({
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
async function requestMoreInfo(merchantName, phaseNumber, missingInfo, message) {
    const phase = getPhaseByNumber(phaseNumber);
    const template = getTemplateByName('email_request_info');
    if (!phase) {
        return { success: false, message: 'Phase không tồn tại' };
    }
    // Save decision
    const decision = {
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
        const result = await (0, email_1.sendEmailAdvanced)({
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
function formatResponse(responseType, variables) {
    const responseFormat = getResponseFormat(responseType);
    if (!responseFormat)
        return null;
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
        format: responseFormat.format
    };
}
exports.default = {
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
