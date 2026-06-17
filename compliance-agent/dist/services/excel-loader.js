"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllData = loadAllData;
exports.getData = getData;
exports.reloadData = reloadData;
const XLSX = __importStar(require("xlsx"));
const path = __importStar(require("path"));
// Path to Excel template
const EXCEL_PATH = path.join(__dirname, '..', '..', 'Compliance_agent_template.xlsx');
// Load Excel file
function loadExcel() {
    try {
        return XLSX.readFile(EXCEL_PATH);
    }
    catch (error) {
        console.error('Error loading Excel file:', error);
        throw error;
    }
}
// Parse approval phases
function parseApprovalPhases(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        phaseNumber: row['Phase Number'],
        phase: row['Phase'],
        summary: row['Summary'],
        dept: row['Dept'],
        pic: row['PIC'],
        picEmail: row["PIC's Emails"],
        picTasks: row["PIC's Tasks"],
        reviewCriteria: row['Review Criteria'],
        requiredDocuments: row['Required Documents'],
        approvalType: row['Approval Type']
    }));
}
// Parse approval actions
function parseApprovalActions(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        useCase: row['Use case'],
        description: row['Mô tả Use case'],
        agentsActions: row['Agents Actions'],
        actionType: row['Action Type'],
        targetService: row['Target Service'],
        requiredInputs: row['Required Inputs'],
        templateReference: row['Template Reference']
    }));
}
// Parse commands
function parseCommands(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        command: row['Command'],
        keywords: row['Keywords'],
        description: row['Description'],
        requiredParams: row['Required Params'],
        example: row['Example']
    }));
}
// Parse templates
function parseTemplates(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        templateName: row['Template Name'],
        templateType: row['Template Type'],
        phase: row['Phase'],
        isHTML: row['Is HTML'] === true || row['Is HTML'] === 'true',
        subject: row['Subject'] || '',
        body: row['Body'] || '',
        variables: row['Variables'] || ''
    }));
}
// Parse review criteria
function parseReviewCriteria(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        phase: row['Phase'],
        criteria: row['Criteria'],
        description: row['Description'],
        required: row['Required'] === true || row['Required'] === 'TRUE',
        weight: row['Weight']
    }));
}
// Parse response formats
function parseResponseFormats(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        responseType: row['Response Type'],
        description: row['Description'],
        format: row['Format'],
        template: row['Template'],
        variables: row['Variables'],
        exampleOutput: row['Example Output']
    }));
}
// Parse knowledge base
function parseKnowledgeBase(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet);
    return data.map((row) => ({
        topic: row['Topic'],
        content: row['Content'],
        keywords: row['Keywords']
    }));
}
// Main load function
function loadAllData() {
    const wb = loadExcel();
    const sheets = wb.SheetNames;
    const data = {
        approvalPhases: [],
        approvalActions: [],
        commands: [],
        templates: [],
        reviewCriteria: [],
        responseFormats: [],
        knowledgeBase: []
    };
    if (sheets.includes('Approval Phases')) {
        data.approvalPhases = parseApprovalPhases(wb.Sheets['Approval Phases']);
    }
    if (sheets.includes('Approval Actions')) {
        data.approvalActions = parseApprovalActions(wb.Sheets['Approval Actions']);
    }
    if (sheets.includes('Commands')) {
        data.commands = parseCommands(wb.Sheets['Commands']);
    }
    if (sheets.includes('Templates')) {
        data.templates = parseTemplates(wb.Sheets['Templates']);
    }
    if (sheets.includes('Review Criteria')) {
        data.reviewCriteria = parseReviewCriteria(wb.Sheets['Review Criteria']);
    }
    if (sheets.includes('Response Formats')) {
        data.responseFormats = parseResponseFormats(wb.Sheets['Response Formats']);
    }
    if (sheets.includes('Knowledge Base')) {
        data.knowledgeBase = parseKnowledgeBase(wb.Sheets['Knowledge Base']);
    }
    console.log('✅ Loaded Compliance Excel data:');
    console.log(`   - Approval Phases: ${data.approvalPhases.length}`);
    console.log(`   - Approval Actions: ${data.approvalActions.length}`);
    console.log(`   - Commands: ${data.commands.length}`);
    console.log(`   - Templates: ${data.templates.length}`);
    console.log(`   - Review Criteria: ${data.reviewCriteria.length}`);
    console.log(`   - Response Formats: ${data.responseFormats.length}`);
    console.log(`   - Knowledge Base: ${data.knowledgeBase.length}`);
    return data;
}
// Cache for data
let cachedData = null;
function getData() {
    if (!cachedData) {
        cachedData = loadAllData();
    }
    return cachedData;
}
function reloadData() {
    cachedData = loadAllData();
    return cachedData;
}
exports.default = {
    loadAllData,
    getData,
    reloadData
};
