export interface OnboardingPhase {
  phaseNumber: number;
  phase: string;
  summary: string;
  dept: string;
  pic: string;
  picEmail: string;
  picTasks: string;
  bdInfo: string;
  requiredDocuments: string[];
}

export interface OnboardingPhasesData {
  phases: OnboardingPhase[];
}

export interface UseCase {
  id: number;
  name: string;
  description: string;
  action: string;
}

export interface AgentsActionsData {
  useCases: UseCase[];
}

export interface MerchantInfo {
  merchantName: string;
  taxId?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface PaymentMethods {
  zalopay: boolean;
  vqr: boolean;
  creditCard: boolean;
}

export interface ValidateRequest {
  phaseNumber: number;
  documents: string[];
}

export interface ValidateResponse {
  phase: OnboardingPhase;
  status: 'Đủ' | 'Thiếu';
  missingDocuments: string[];
}

export interface EmailRequest {
  phaseNumber: number;
  merchantInfo: MerchantInfo;
}

export interface EmailResponse {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export interface TicketRequest {
  merchantName: string;
  paymentMethods: PaymentMethods;
}

export interface TicketResponse {
  title: string;
  description: string;
  labels: string[];
}

export interface SendEmailRequest {
  email: EmailResponse;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  simulatedAt: string;
}