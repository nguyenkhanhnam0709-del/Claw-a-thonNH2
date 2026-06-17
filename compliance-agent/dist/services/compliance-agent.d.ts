import { Template, ResponseFormat } from './excel-loader';
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
export declare function getApprovalPhases(): import("./excel-loader").ApprovalPhase[];
export declare function getPhaseByNumber(phaseNumber: number): import("./excel-loader").ApprovalPhase | undefined;
export declare function getReviewCriteria(phaseNumber: number): import("./excel-loader").ReviewCriteria[];
export declare function getTemplateByName(templateName: string): Template | undefined;
export declare function getTemplateByType(templateType: string): Template | undefined;
export declare function getResponseFormat(responseType: string): ResponseFormat | undefined;
export declare function detectCommand(message: string): string | undefined;
export declare function extractMerchantName(message: string): string | undefined;
export declare function extractPhaseNumber(message: string): number | undefined;
export declare function extractRejectionReason(message: string): string | undefined;
export declare function addPendingRequest(request: DecisionRecord): void;
export declare function getPendingRequests(): DecisionRecord[];
export declare function removePendingRequest(merchantName: string): void;
export declare function saveDecision(decision: DecisionRecord): void;
export declare function getDecisionHistory(merchantName: string): DecisionRecord[];
export declare function getAllDecisions(): DecisionRecord[];
export declare function approveMerchant(merchantName: string, phaseNumber: number, notes?: string): Promise<{
    success: boolean;
    message: string;
    emailSent?: boolean;
}>;
export declare function rejectMerchant(merchantName: string, phaseNumber: number, reason: string, requiredDocuments?: string[]): Promise<{
    success: boolean;
    message: string;
    emailSent?: boolean;
}>;
export declare function requestMoreInfo(merchantName: string, phaseNumber: number, missingInfo: string[], message?: string): Promise<{
    success: boolean;
    message: string;
    emailSent?: boolean;
}>;
export declare function formatResponse(responseType: string, variables: Record<string, string>): {
    content: string;
    format: 'html' | 'text';
} | null;
declare const _default: {
    getApprovalPhases: typeof getApprovalPhases;
    getPhaseByNumber: typeof getPhaseByNumber;
    getReviewCriteria: typeof getReviewCriteria;
    getTemplateByName: typeof getTemplateByName;
    getTemplateByType: typeof getTemplateByType;
    getResponseFormat: typeof getResponseFormat;
    detectCommand: typeof detectCommand;
    extractMerchantName: typeof extractMerchantName;
    extractPhaseNumber: typeof extractPhaseNumber;
    extractRejectionReason: typeof extractRejectionReason;
    addPendingRequest: typeof addPendingRequest;
    getPendingRequests: typeof getPendingRequests;
    removePendingRequest: typeof removePendingRequest;
    saveDecision: typeof saveDecision;
    getDecisionHistory: typeof getDecisionHistory;
    getAllDecisions: typeof getAllDecisions;
    approveMerchant: typeof approveMerchant;
    rejectMerchant: typeof rejectMerchant;
    requestMoreInfo: typeof requestMoreInfo;
    formatResponse: typeof formatResponse;
};
export default _default;
