import onboardingPhasesData from '../data/onboarding-phases.json';
import agentsActionsData from '../data/agents-actions.json';
import templatesData from '../data/templates.json';
import * as formatters from './formatters';
import {
  OnboardingPhase,
  OnboardingPhasesData,
  UseCase,
  AgentsActionsData,
  ValidateRequest,
  ValidateResponse,
  EmailRequest,
  EmailResponse,
  TicketRequest,
  TicketResponse,
  SendEmailRequest,
  SendEmailResponse,
} from '../types';

const phasesData = onboardingPhasesData as OnboardingPhasesData;
const actionsData = agentsActionsData as AgentsActionsData;
const templates = (templatesData as any).templates as Record<string, {
  type: string;
  phase: number;
  isHtml: boolean;
  subject: string;
  body: string;
  variables: string[];
}>;

// Render a template string: replace {{var}} with values; leftover vars -> fallback
function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== '' ? vars[key] : '(chưa cung cấp)'
  );
}

// Use Case 1: Giải đáp quy trình Onboarding cho BD
export function getProcessOverview(): {
  phases: OnboardingPhase[];
  useCases: UseCase[];
  formattedPhases: string;
  formattedUseCases: string;
} {
  return {
    phases: phasesData.phases,
    useCases: actionsData.useCases,
    formattedPhases: formatters.formatAllPhasesWithDetails(phasesData.phases),
    formattedUseCases: formatters.formatUseCases(actionsData.useCases),
  };
}

// Get single phase by number
export function getPhaseByNumber(phaseNumber: number): OnboardingPhase | undefined {
  return phasesData.phases.find((p) => p.phaseNumber === phaseNumber);
}

// Use Case 2: Validate tài liệu
export function validateDocuments(request: ValidateRequest): ValidateResponse {
  const phase = getPhaseByNumber(request.phaseNumber);

  if (!phase) {
    return {
      phase: {} as OnboardingPhase,
      status: 'Thiếu',
      missingDocuments: ['Phase không tồn tại'],
    };
  }

  // Simple contains check - case insensitive
  const containsIgnoreCase = (source: string, target: string): boolean => {
    return source.toLowerCase().includes(target.toLowerCase());
  };

  const missingDocs: string[] = [];
  for (const required of phase.requiredDocuments) {
    const found = request.documents.some(
      (doc) => containsIgnoreCase(doc, required) || containsIgnoreCase(required, doc)
    );
    if (!found) {
      missingDocs.push(required);
    }
  }

  return {
    phase,
    status: missingDocs.length === 0 ? 'Đủ' : 'Thiếu',
    missingDocuments: missingDocs,
  };
}

// Use Case 3: Tạo email (render từ Templates sheet -> templates.json)
export function generateEmail(request: EmailRequest): EmailResponse {
  const phase = getPhaseByNumber(request.phaseNumber);

  if (!phase) {
    throw new Error('Phase không tồn tại');
  }

  // Bước 1, 2, 4 mới tạo email được
  if (![1, 2, 4].includes(request.phaseNumber)) {
    throw new Error('Bước 3 (Tích hợp kỹ thuật) không tạo email, vui lòng tạo ticket');
  }

  const tpl = templates[`email_phase${request.phaseNumber}`];
  if (!tpl) {
    throw new Error(`Không tìm thấy template email cho Phase ${request.phaseNumber}`);
  }

  const info = request.merchantInfo;
  const vars: Record<string, string> = {
    picName: phase.pic,
    merchantName: info.merchantName,
    taxId: info.taxId || '',
    bankAccount: info.bankAccount || '',
    bankName: info.bankName || '',
  };

  return {
    to: phase.picEmail,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
  };
}

// Use Case 4: Tạo ticket (render từ ticket_phase3 template)
export function generateTicket(request: TicketRequest): TicketResponse {
  const tpl = templates['ticket_phase3'];

  const vars: Record<string, string> = {
    merchantName: request.merchantName,
    zalopay: request.paymentMethods.zalopay ? 'Có' : 'Không',
    vqr: request.paymentMethods.vqr ? 'Có' : 'Không',
    creditCard: request.paymentMethods.creditCard ? 'Có' : 'Không',
  };

  return {
    title: renderTemplate(tpl.subject, vars),
    description: renderTemplate(tpl.body, vars),
    labels: ['onboarding', 'payment-integration'],
  };
}

// Use Case 5: Simulate gửi email
export function simulateSendEmail(request: SendEmailRequest): SendEmailResponse {
  const email = request.email;

  // Simulate successful send
  return {
    success: true,
    message: `Email đã được simulate gửi thành công đến ${email.to}`,
    simulatedAt: new Date().toISOString(),
  };
}