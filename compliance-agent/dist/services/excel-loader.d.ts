export interface ApprovalPhase {
    phaseNumber: number;
    phase: string;
    summary: string;
    dept: string;
    pic: string;
    picEmail: string;
    picTasks: string;
    reviewCriteria: string;
    requiredDocuments: string;
    approvalType: string;
}
export interface ApprovalAction {
    useCase: number;
    description: string;
    agentsActions: string;
    actionType: string;
    targetService: string;
    requiredInputs: string;
    templateReference: string;
}
export interface Command {
    command: string;
    keywords: string;
    description: string;
    requiredParams: string;
    example: string;
}
export interface Template {
    templateName: string;
    templateType: string;
    phase: number | string;
    isHTML: boolean;
    subject: string;
    body: string;
    variables: string;
}
export interface ReviewCriteria {
    phase: number;
    criteria: string;
    description: string;
    required: boolean;
    weight: string;
}
export interface ResponseFormat {
    responseType: string;
    description: string;
    format: string;
    template: string;
    variables: string;
    exampleOutput: string;
}
export interface KnowledgeBase {
    topic: string;
    content: string;
    keywords: string;
}
export interface ComplianceData {
    approvalPhases: ApprovalPhase[];
    approvalActions: ApprovalAction[];
    commands: Command[];
    templates: Template[];
    reviewCriteria: ReviewCriteria[];
    responseFormats: ResponseFormat[];
    knowledgeBase: KnowledgeBase[];
}
export declare function loadAllData(): ComplianceData;
export declare function getData(): ComplianceData;
export declare function reloadData(): ComplianceData;
declare const _default: {
    loadAllData: typeof loadAllData;
    getData: typeof getData;
    reloadData: typeof reloadData;
};
export default _default;
