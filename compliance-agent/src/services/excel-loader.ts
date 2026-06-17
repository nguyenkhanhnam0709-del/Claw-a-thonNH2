import * as XLSX from 'xlsx';
import * as path from 'path';

// Path to Excel template
const EXCEL_PATH = path.join(__dirname, '..', '..', 'Compliance_agent_template.xlsx');

// Types
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

// Load Excel file
function loadExcel(): XLSX.WorkBook {
  try {
    return XLSX.readFile(EXCEL_PATH);
  } catch (error) {
    console.error('Error loading Excel file:', error);
    throw error;
  }
}

// Parse approval phases
function parseApprovalPhases(sheet: XLSX.WorkSheet): ApprovalPhase[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
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
function parseApprovalActions(sheet: XLSX.WorkSheet): ApprovalAction[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
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
function parseCommands(sheet: XLSX.WorkSheet): Command[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
    command: row['Command'],
    keywords: row['Keywords'],
    description: row['Description'],
    requiredParams: row['Required Params'],
    example: row['Example']
  }));
}

// Parse templates
function parseTemplates(sheet: XLSX.WorkSheet): Template[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
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
function parseReviewCriteria(sheet: XLSX.WorkSheet): ReviewCriteria[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
    phase: row['Phase'],
    criteria: row['Criteria'],
    description: row['Description'],
    required: row['Required'] === true || row['Required'] === 'TRUE',
    weight: row['Weight']
  }));
}

// Parse response formats
function parseResponseFormats(sheet: XLSX.WorkSheet): ResponseFormat[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
    responseType: row['Response Type'],
    description: row['Description'],
    format: row['Format'],
    template: row['Template'],
    variables: row['Variables'],
    exampleOutput: row['Example Output']
  }));
}

// Parse knowledge base
function parseKnowledgeBase(sheet: XLSX.WorkSheet): KnowledgeBase[] {
  const data = XLSX.utils.sheet_to_json(sheet);
  return data.map((row: any) => ({
    topic: row['Topic'],
    content: row['Content'],
    keywords: row['Keywords']
  }));
}

// Main load function
export function loadAllData(): ComplianceData {
  const wb = loadExcel();
  const sheets = wb.SheetNames;

  const data: ComplianceData = {
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
let cachedData: ComplianceData | null = null;

export function getData(): ComplianceData {
  if (!cachedData) {
    cachedData = loadAllData();
  }
  return cachedData;
}

export function reloadData(): ComplianceData {
  cachedData = loadAllData();
  return cachedData;
}

export default {
  loadAllData,
  getData,
  reloadData
};