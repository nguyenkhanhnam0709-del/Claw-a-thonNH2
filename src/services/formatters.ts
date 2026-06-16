/**
 * Formatters for clean Vietnamese output with diacritics
 * No Markdown formatting - plain text only
 */

import { OnboardingPhase, UseCase } from '../types';

/**
 * Format all phases with details
 */
export function formatAllPhasesWithDetails(phases: OnboardingPhase[]): string {
  let output = `Quy trình onboarding merchant - Zalopay

Chào bạn! Dưới đây là 4 bước trong quy trình onboarding merchant mới cho giải pháp thanh toán Zalopay:

Bước 1: Thẩm định merchant
  Phòng ban: Compliance
  PIC: KhoaNVM | Email: hungnqvng@gmail.com
  Mô tả: BD gửi email hồ sơ → CPL review → Approve/Reject
  Nhiệm vụ PIC: Review giấy phép kinh doanh
  Tài liệu BD gửi: Giấy phép kinh doanh

Bước 2: Review hợp đồng
  Phòng ban: Legal
  PIC: TuPNC | Email: vnglegal@gmail.com
  Mô tả: BD gửi email draft HĐ + CPL confirm → LG review → Approve
  Nhiệm vụ PIC: Review hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant
  Tài liệu BD gửi: Draft hợp đồng

Bước 3: Tích hợp kỹ thuật
  Phòng ban: Tech
  PIC: NhanNĐT | Email: hieulv3@vng.com.vn
  Mô tả: BD tạo ticket Jira gồm thông tin Tạo App ID trên Sandbox → Tích hợp → QC test → Production
  Nhiệm vụ PIC: Tạo App ID và hỗ trợ merchant tích hợp Zalopay Gateway API. Quy trình gồm 2 môi trường: Sandbox (test) và Production
  Tài liệu BD gửi: Thông tin tích hợp

Bước 4: Tạo FA code
  Phòng ban: Accounting
  PIC: ChienNM | Email: quochung.ng4801.work@gmail.com
  Mô tả: BD gửi email thông tin → FA tạo PaymentID → Cung cấp cho MC
  Nhiệm vụ PIC: Tạo PaymentID (Mã FA), Mã thanh toán (P-xxxxx), cấu hình nguồn tiền bank/wallet
  Tài liệu BD gửi: Mã số thuế, Tài khoản ngân hàng

Bạn cần hỗ trợ gì ở đây? Ví dụ:
- Gửi email cho Bước 1, 2, 4
- Tạo ticket cho Bước 3
- Kiểm tra tài liệu/thông tin
`;

  return output;
}

/**
 * Format use cases
 */
export function formatUseCases(useCases: UseCase[]): string {
  let output = `Các tác vụ hỗ trợ:

`;

  useCases.forEach((uc, idx) => {
    output += `${idx + 1}. ${uc.name}\n`;
    output += `   Action: ${uc.action}\n`;
    output += `   Mô tả: ${uc.description}\n\n`;
  });

  return output;
}

/**
 * Format validation result
 */
export function formatValidationResult(
  phaseName: string,
  status: 'Đủ' | 'Thiếu',
  missingDocs: string[]
): string {
  if (status === 'Đủ') {
    return `[OK] Tài liệu Bước ${phaseName} đã đủ!\n\nTất cả tài liệu cần thiết đã được nộp.`;
  }

  return `[CANH BAO] Thiếu tài liệu Bước ${phaseName}\n\nCác tài liệu còn thiếu:\n${missingDocs.map(d => `  - ${d}`).join('\n')}`;
}

/**
 * Format email template preview
 */
export function formatEmailPreview(
  to: string,
  subject: string,
  body: string,
  phaseName: string
): string {
  return `EMAIL PREVIEW - ${phaseName.toUpperCase()}

To: ${to}
Subject: ${subject}

${body}

[Lưu ý] Email sẽ được gửi thực khi bạn xác nhận`;
}

/**
 * Format ticket template
 */
export function formatTicket(
  title: string,
  description: string,
  labels: string[]
): string {
  return `JIRA TICKET TEMPLATE

Title: ${title}

Description:
${description}

Labels: ${labels.join(', ')}

[Lưu ý] Copy và tạo ticket thủ công trên Jira`;
}

/**
 * Helper: Wrap text
 */
function wrapText(text: string, width: number, prefix: string = ''): string {
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.map(line => prefix + line).join('\n');
}