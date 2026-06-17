/**
 * Response formatters — khớp với sheet "Response Formats" trong template.
 * Template gốc viết dạng HTML (<b>, <br>); ở đây render sang Markdown tương đương
 * để UI (renderMarkdown) hiển thị đúng emoji + bố cục mà không lộ thẻ HTML.
 */

import { OnboardingPhase, UseCase } from '../types';

/** phase_list — Hiển thị danh sách các giai đoạn onboarding */
export function formatAllPhasesWithDetails(phases: OnboardingPhase[]): string {
  let out = '📋 **Quy trình Onboarding:**\n';
  for (const p of phases) {
    out += `\n**Giai đoạn ${p.phaseNumber}:** ${p.phase}\n`;
    out += `  └ PIC: ${p.pic} | Email: ${p.picEmail}\n`;
    out += `  └ Yêu cầu: ${p.requiredDocuments.join(', ')}\n`;
  }
  return out.trimEnd();
}

/** phase_detail — Chi tiết một giai đoạn cụ thể */
export function formatPhaseDetail(phase: OnboardingPhase): string {
  return [
    `📌 **Giai đoạn ${phase.phaseNumber}: ${phase.phase}**`,
    ``,
    `🔹 **Tóm tắt:** ${phase.summary}`,
    `🔹 **Phòng ban:** ${phase.dept}`,
    `🔹 **PIC:** ${phase.pic}`,
    `🔹 **Email PIC:** ${phase.picEmail}`,
    `🔹 **Nhiệm vụ PIC:** ${phase.picTasks}`,
    `🔹 **Tài liệu yêu cầu:** ${phase.requiredDocuments.join(', ')}`,
  ].join('\n');
}

/** validation_result — Kết quả kiểm tra tài liệu */
export function formatValidationResult(
  phaseNumber: number,
  status: 'Đủ' | 'Thiếu',
  presentDocs: string[],
  missingDocs: string[]
): string {
  const present = presentDocs.length ? presentDocs.map((d) => `- ${d}`).join('\n') : '- (chưa có)';
  const missing = missingDocs.length ? missingDocs.map((d) => `- ${d}`).join('\n') : '- (không thiếu)';
  return [
    `✅ **Kiểm tra tài liệu - Giai đoạn ${phaseNumber}**`,
    ``,
    `**Status:** ${status}`,
    ``,
    `📄 **Tài liệu đã có:**`,
    present,
    ``,
    `❌ **Tài liệu thiếu:**`,
    missing,
  ].join('\n');
}

/** email_preview — Preview email trước khi gửi */
export function formatEmailPreview(to: string, subject: string, body: string): string {
  return [
    `📧 **Preview Email**`,
    ``,
    `**To:** ${to}`,
    `**Subject:** ${subject}`,
    ``,
    `---`,
    body,
    `---`,
  ].join('\n');
}

/** email_sent — Thông báo email đã gửi */
export function formatEmailSent(to: string, subject: string, sentAt: string, cc?: string, attachments?: string): string {
  const lines = [
    `✅ **Đã gửi email thành công!**`,
    ``,
    `**To:** ${to}`,
  ];
  if (cc) lines.push(`**CC:** ${cc}`);
  lines.push(`**Subject:** ${subject}`);
  if (attachments) lines.push(`**📎 Đính kèm:** ${attachments}`);
  lines.push(`**Thời gian:** ${sentAt}`);
  return lines.join('\n');
}

/** ticket_preview — Preview ticket trước khi tạo */
export function formatTicket(title: string, description: string, labels: string[]): string {
  return [
    `📝 **Preview Ticket**`,
    ``,
    `**Title:** ${title}`,
    ``,
    `**Description:**`,
    description,
    ``,
    `**Labels:** ${labels.join(', ')}`,
  ].join('\n');
}

/** tax_lookup_result — Kết quả tra cứu MST */
export function formatTaxLookup(
  companyName: string,
  mst: string,
  address: string,
  status: string
): string {
  return [
    `🔍 **Kết quả tra cứu MST**`,
    ``,
    `**Công ty:** ${companyName}`,
    `**MST:** ${mst}`,
    `**Địa chỉ:** ${address}`,
    `**Trạng thái:** ${status}`,
  ].join('\n');
}

/** error — Thông báo lỗi */
export function formatError(errorTitle: string, errorMessage: string): string {
  return `❌ **${errorTitle}**\n\n${errorMessage}`;
}

/** Danh sách use case (giữ cho tham khảo nội bộ) */
export function formatUseCases(useCases: UseCase[]): string {
  let output = 'Các tác vụ hỗ trợ:\n\n';
  useCases.forEach((uc, idx) => {
    output += `${idx + 1}. ${uc.name}\n   Action: ${uc.action}\n   Mô tả: ${uc.description}\n\n`;
  });
  return output;
}
