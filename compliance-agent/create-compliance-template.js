const XLSX = require('xlsx');
const path = require('path');

// ==================== SHEET 1: Approval Phases ====================
const approvalPhasesData = [
  {
    'Phase Number': 1,
    'Phase': 'Thẩm định Merchant',
    'Summary': 'Compliance review giấy phép kinh doanh và các tài liệu pháp lý của merchant',
    'Dept': 'Compliance',
    'PIC': 'KhoaNVM',
    "PIC's Emails": 'hungnqvng@gmail.com',
    "PIC's Tasks": 'Review giấy phép kinh doanh, xác minh thông tin pháp lý, đánh giá rủi ro',
    'Review Criteria': 'GPKD hợp lệ, không vi phạm chính sách, không trong danh sách đen',
    'Required Documents': 'Giấy phép kinh doanh, CMND/CCCD người đại diện',
    'Approval Type': 'merchant_approval'
  }
];

// ==================== SHEET 2: Approval Actions ====================
const approvalActionsData = [
  {
    'Use case': 1,
    'Mô tả Use case': 'Biz gửi request review hồ sơ merchant',
    'Agents Actions': 'Nhận request từ Biz, hiển thị thông tin merchant cần review',
    'Action Type': 'receive_request',
    'Target Service': 'compliance-agent',
    'Required Inputs': 'merchantName, phaseNumber, documents[], requestFrom',
    'Template Reference': ''
  },
  {
    'Use case': 2,
    'Mô tả Use case': 'Compliance review tài liệu và đưa ra quyết định',
    'Agents Actions': 'Kiểm tra tài liệu, đối chiếu với tiêu chí, đưa ra quyết định Approve/Reject',
    'Action Type': 'review',
    'Target Service': 'compliance-agent',
    'Required Inputs': 'merchantName, phaseNumber, documents[], reviewNotes',
    'Template Reference': 'Templates!review_criteria'
  },
  {
    'Use case': 3,
    'Mô tả Use case': 'Compliance duyệt (Approve) hồ sơ merchant',
    'Agents Actions': 'Tạo email thông báo approve cho Biz, cập nhật trạng thái',
    'Action Type': 'approve',
    'Target Service': 'email-service',
    'Required Inputs': 'merchantName, phaseNumber, approvalNotes',
    'Template Reference': 'Templates!email_approve'
  },
  {
    'Use case': 4,
    'Mô tả Use case': 'Compliance từ chối (Reject) hồ sơ merchant',
    'Agents Actions': 'Tạo email thông báo reject kèm lý do chi tiết cho Biz',
    'Action Type': 'reject',
    'Target Service': 'email-service',
    'Required Inputs': 'merchantName, phaseNumber, rejectionReason, requiredDocuments',
    'Template Reference': 'Templates!email_reject'
  },
  {
    'Use case': 5,
    'Mô tả Use case': 'Compliance yêu cầu bổ sung thông tin',
    'Agents Actions': 'Tạo email yêu cầu Biz bổ sung tài liệu/thông tin',
    'Action Type': 'request_info',
    'Target Service': 'email-service',
    'Required Inputs': 'merchantName, phaseNumber, missingInfo[], requestMessage',
    'Template Reference': 'Templates!email_request_info'
  },
  {
    'Use case': 6,
    'Mô tả Use case': 'Compliance xem lại lịch sử quyết định',
    'Agents Actions': 'Tra cứu và hiển thị lịch sử approval/reject',
    'Action Type': 'history',
    'Target Service': 'memory-service',
    'Required Inputs': 'merchantName',
    'Template Reference': ''
  }
];

// ==================== SHEET 3: Commands ====================
const commandsData = [
  {
    'Command': 'xem_yeu_cau',
    'Keywords': 'xem request, xem yêu cầu, hiển thị, danh sách, list, pending',
    'Description': 'Hiển thị các request chờ xử lý',
    'Required Params': '',
    'Example': 'Cho tôi xem các request đang chờ'
  },
  {
    'Command': 'review',
    'Keywords': 'review, kiểm tra, xem xét, đánh giá, phân tích',
    'Description': 'Review hồ sơ merchant và đưa ra quyết định',
    'Required Params': 'merchantName, phaseNumber',
    'Example': 'Review hồ sơ merchant ABC giai đoạn 1'
  },
  {
    'Command': 'approve',
    'Keywords': 'approve, duyệt, chấp thuận, đồng ý, ok, yes',
    'Description': 'Approve hồ sơ merchant',
    'Required Params': 'merchantName, phaseNumber, notes',
    'Example': 'Approve merchant ABC giai đoạn 1'
  },
  {
    'Command': 'reject',
    'Keywords': 'reject, từ chối, không duyệt, không đồng ý, khong duyet',
    'Description': 'Reject hồ sơ merchant kèm lý do',
    'Required Params': 'merchantName, phaseNumber, reason',
    'Example': 'Reject merchant ABC giai đoạn 1 vì GPKD hết hạn'
  },
  {
    'Command': 'yeu_cau_bo_sung',
    'Keywords': 'bổ sung, yêu cầu thêm, cần thêm, chưa đủ',
    'Description': 'Yêu cầu Biz bổ sung thông tin/tài liệu',
    'Required Params': 'merchantName, phaseNumber, missingInfo',
    'Example': 'Yêu cầu bổ sung GPKD cho merchant ABC'
  },
  {
    'Command': 'lich_su',
    'Keywords': 'lịch sử, history, quá trình, timeline, đã xử lý',
    'Description': 'Xem lịch sử quyết định của một merchant',
    'Required Params': 'merchantName',
    'Example': 'Xem lịch sử merchant ABC'
  },
  {
    'Command': 'tra_cuu',
    'Keywords': 'tra cứu, tìm kiếm, search, lookup',
    'Description': 'Tra cứu thông tin merchant',
    'Required Params': 'merchantName',
    'Example': 'Tra cứu thông tin merchant ABC'
  },
  {
    'Command': 'quy_trinh',
    'Keywords': 'quy trình, process, hướng dẫn, hỗ trợ',
    'Description': 'Hiển thị quy trình approval của Compliance',
    'Required Params': '',
    'Example': 'Quy trình approval của Compliance là gì?'
  }
];

// ==================== SHEET 4: Templates ====================
const templatesData = [
  {
    'Template Name': 'email_approve',
    'Template Type': 'email',
    'Phase': 1,
    'Is HTML': true,
    'Subject': '[Onboarding] ✅ Approved - {{merchantName}} - Phase {{phaseNumber}}',
    'Body': `<p>Kính gửi Biz Team,</p>

<p>Hồ sơ merchant <strong>{{merchantName}}</strong> (Phase {{phaseNumber}}) đã được <span style="color: green; font-weight: bold;">✅ APPROVE</span>.</p>

<p><strong>Thông tin được duyệt:</strong></p>
<ul>
<li><strong>Merchant:</strong> {{merchantName}}</li>
<li><strong>Phase:</strong> {{phaseNumber}}</li>
<li><strong>Ngày duyệt:</strong> {{approvedDate}}</li>
</ul>

{{#if notes}}
<p><strong>Ghi chú:</strong></p>
<p>{{notes}}</p>
{{/if}}

<p>Vui lòng tiến hành các bước tiếp theo trong quy trình onboarding.</p>

<p>Trân trọng,<br>
Compliance Team</p>`,
    'Variables': 'merchantName, phaseNumber, approvedDate, notes'
  },
  {
    'Template Name': 'email_reject',
    'Template Type': 'email',
    'Phase': 1,
    'Is HTML': true,
    'Subject': '[Onboarding] ❌ Rejected - {{merchantName}} - Phase {{phaseNumber}}',
    'Body': `<p>Kính gửi Biz Team,</p>

<p>Hồ sơ merchant <strong>{{merchantName}}</strong> (Phase {{phaseNumber}}) đã được <span style="color: red; font-weight: bold;">❌ REJECT</span>.</p>

<p><strong>Thông tin bị từ chối:</strong></p>
<ul>
<li><strong>Merchant:</strong> {{merchantName}}</li>
<li><strong>Phase:</strong> {{phaseNumber}}</li>
<li><strong>Ngày từ chối:</strong> {{rejectedDate}}</li>
</ul>

<p><strong style="color: red;">Lý do từ chối:</strong></p>
<p>{{rejectionReason}}</p>

{{#if requiredDocuments}}
<p><strong>Cần bổ sung:</strong></p>
<ul>
{{#each requiredDocuments}}
<li>{{this}}</li>
{{/each}}
</ul>
{{/if}}

<p>Vui lòng thông báo cho merchant và tiến hành bổ sung nếu cần.</p>

<p>Trân trọng,<br>
Compliance Team</p>`,
    'Variables': 'merchantName, phaseNumber, rejectedDate, rejectionReason, requiredDocuments'
  },
  {
    'Template Name': 'email_request_info',
    'Template Type': 'email',
    'Phase': 1,
    'Is HTML': true,
    'Subject': '[Onboarding] ⏳ Cần bổ sung thông tin - {{merchantName}} - Phase {{phaseNumber}}',
    'Body': `<p>Kính gửi Biz Team,</p>

<p>Hồ sơ merchant <strong>{{merchantName}}</strong> (Phase {{phaseNumber}}) cần <span style="color: orange; font-weight: bold;">⏳ BỔ SUNG THÔNG TIN</span>.</p>

<p><strong>Thông tin merchant:</strong></p>
<ul>
<li><strong>Merchant:</strong> {{merchantName}}</li>
<li><strong>Phase:</strong> {{phaseNumber}}</li>
</ul>

<p><strong style="color: orange;">Cần bổ sung:</strong></p>
<ul>
{{#each missingInfo}}
<li>{{this}}</li>
{{/each}}
</ul>

{{#if requestMessage}}
<p><strong>Chi tiết:</strong></p>
<p>{{requestMessage}}</p>
{{/if}}

<p>Vui lòng bổ sung thông tin để tiếp tục quá trình review.</p>

<p>Trân trọng,<br>
Compliance Team</p>`,
    'Variables': 'merchantName, phaseNumber, missingInfo, requestMessage'
  },
  {
    'Template Name': 'request_received',
    'Template Type': 'notification',
    'Phase': '',
    'Is HTML': true,
    'Subject': '[Onboarding] 📥 Request nhận - {{merchantName}}',
    'Body': `<p>✅ <strong>Đã nhận request từ Biz</strong></p>

<p><strong>Thông tin:</strong></p>
<ul>
<li><strong>Merchant:</strong> {{merchantName}}</li>
<li><strong>Phase:</strong> {{phaseNumber}}</li>
<li><strong>Từ:</strong> {{requestFrom}}</li>
<li><strong>Thời gian:</strong> {{requestTime}}</li>
</ul>

{{#if documents}}
<p><strong>Tài liệu đính kèm:</strong></p>
<ul>
{{#each documents}}
<li>{{this}}</li>
{{/each}}
</ul>
{{/if}}

<p>Vui lòng review và đưa ra quyết định (Approve/Reject/Yêu cầu bổ sung).</p>`,
    'Variables': 'merchantName, phaseNumber, requestFrom, requestTime, documents'
  }
];

// ==================== SHEET 5: Review Criteria ====================
const reviewCriteriaData = [
  {
    'Phase': 1,
    'Criteria': 'Giấy phép kinh doanh hợp lệ',
    'Description': 'GPKD còn hiệu lực, ngành nghề kinh doanh phù hợp',
    'Required': true,
    'Weight': 'high'
  },
  {
    'Phase': 1,
    'Criteria': 'Không trong danh sách đen',
    'Description': 'Merchant không thuộc danh sách đen của ZaloPay/VNG',
    'Required': true,
    'Weight': 'high'
  },
  {
    'Phase': 1,
    'Criteria': 'CMND/CCCD người đại diện hợp lệ',
    'Description': 'CMND/CCCD còn hiệu lực, thông tin khớp với GPKD',
    'Required': true,
    'Weight': 'medium'
  },
  {
    'Phase': 1,
    'Criteria': 'Không vi phạm chính sách',
    'Description': 'Merchant không kinh doanh các ngành nghề cấm/trong blacklist',
    'Required': true,
    'Weight': 'high'
  }
];

// ==================== SHEET 6: Response Formats ====================
const responseFormatsData = [
  {
    'Response Type': 'request_list',
    'Description': 'Danh sách request chờ xử lý',
    'Format': 'html',
    'Template': `<b>📋 Danh sách Request chờ xử lý:</b><br><br>
{{#each requests}}
<b>{{index}}. {{merchantName}}</b> - Phase {{phaseNumber}}<br>
   └ Từ: {{requestFrom}} | Thời gian: {{requestTime}}<br>
   └ Tài liệu: {{documents}}<br><br>
{{/each}}
<small>Sử dụng lệnh "review [merchantName]" để review từng merchant</small>`,
    'Variables': 'requests',
    'Example Output': 'Danh sách request...'
  },
  {
    'Response Type': 'review_result',
    'Description': 'Kết quả review hồ sơ',
    'Format': 'html',
    'Template': `<b>📊 Review hồ sơ: {{merchantName}}</b><br><br>
<b>Phase:</b> {{phaseNumber}}<br>
<b>Trạng thái:</b> {{status}}<br><br>
<b>✅ Đạt:</b><br>{{passedCriteria}}<br><br>
<b>❌ Chưa đạt:</b><br>{{failedCriteria}}<br><br>
<b>Ghi chú:</b><br>{{notes}}`,
    'Variables': 'merchantName, phaseNumber, status, passedCriteria, failedCriteria, notes',
    'Example Output': 'Review result...'
  },
  {
    'Response Type': 'approval_confirmation',
    'Description': 'Xác nhận approve thành công',
    'Format': 'html',
    'Template': `<div style="background: #d4edda; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb;">
<p style="margin: 0; color: #155724;"><b>✅ {{merchantName}} - APPROVED</b></p>
</div>
<br>
<b>Phase:</b> {{phaseNumber}}<br>
<b>Thời gian:</b> {{approvedDate}}<br>
{{#if notes}}
<b>Ghi chú:</b> {{notes}}<br>
{{/if}}
<p>Email thông báo đã được gửi cho Biz Team.</p>`,
    'Variables': 'merchantName, phaseNumber, approvedDate, notes',
    'Example Output': 'Approved confirmation...'
  },
  {
    'Response Type': 'rejection_confirmation',
    'Description': 'Xác nhận reject thành công',
    'Format': 'html',
    'Template': `<div style="background: #f8d7da; padding: 15px; border-radius: 5px; border: 1px solid #f5c6cb;">
<p style="margin: 0; color: #721c24;"><b>❌ {{merchantName}} - REJECTED</b></p>
</div>
<br>
<b>Phase:</b> {{phaseNumber}}<br>
<b>Thời gian:</b> {{rejectedDate}}<br>
<b>Lý do:</b> {{rejectionReason}}<br>
{{#if requiredDocuments}}
<b>Cần bổ sung:</b> {{requiredDocuments}}<br>
{{/if}}
<p>Email thông báo đã được gửi cho Biz Team.</p>`,
    'Variables': 'merchantName, phaseNumber, rejectedDate, rejectionReason, requiredDocuments',
    'Example Output': 'Rejected confirmation...'
  },
  {
    'Response Type': 'history',
    'Description': 'Lịch sử quyết định',
    'Format': 'html',
    'Template': `<b>📜 Lịch sử: {{merchantName}}</b><br><br>
{{#each history}}
<b>{{index}}. {{status}} - Phase {{phaseNumber}}</b><br>
   └ Ngày: {{date}}<br>
   └ Lý do/Notes: {{reason}}<br><br>
{{/each}}`,
    'Variables': 'merchantName, history',
    'Example Output': 'History...'
  },
  {
    'Response Type': 'phase_list',
    'Description': 'Danh sách phase của Compliance',
    'Format': 'html',
    'Template': `<b>📋 Quy trình Approval - Compliance:</b><br><br>
<b>Phase 1:</b> Thẩm định Merchant<br>
   └ PIC: {{phase1_pic}} | Email: {{phase1_email}}<br>
   └ Yêu cầu: {{phase1_docs}}<br>
   └ Tiêu chí: {{phase1_criteria}}<br><br>
<b>Lệnh:</b><br>
- "review [merchant]" : Review hồ sơ<br>
- "approve [merchant]" : Duyệt<br>
- "reject [merchant] [lý do]" : Từ chối<br>
- "bổ sung [merchant] [thông tin]" : Yêu cầu bổ sung`,
    'Variables': 'phase1_pic, phase1_email, phase1_docs, phase1_criteria',
    'Example Output': 'Phase list...'
  },
  {
    'Response Type': 'error',
    'Description': 'Thông báo lỗi',
    'Format': 'text',
    'Template': `❌ {{errorTitle}}

{{errorMessage}}`,
    'Variables': 'errorTitle, errorMessage',
    'Example Output': 'Error...'
  }
];

// ==================== SHEET 7: Knowledge Base ====================
const knowledgeBaseData = [
  {
    'Topic': 'Quy trình Approval',
    'Content': 'Compliance nhận request từ Biz -> Review tài liệu -> Đối chiếu tiêu chí -> Đưa ra quyết định (Approve/Reject/Yêu cầu bổ sung) -> Thông báo cho Biz',
    'Keywords': 'quy trình, process, approval, workflow'
  },
  {
    'Topic': 'Tiêu chí Phase 1 - Thẩm định Merchant',
    'Content': '1. GPKD hợp lệ và còn hiệu lực\n2. Không trong danh sách đen\n3. CMND/CCCD người đại diện hợp lệ\n4. Không vi phạm chính sách (ngành nghề cấm)',
    'Keywords': 'phase 1, thẩm định, merchant, tiêu chí, GPKD'
  },
  {
    'Topic': 'Xử lý Reject',
    'Content': 'Khi reject cần nêu rõ lý do cụ thể và các tài liệu cần bổ sung (nếu có). Gửi email thông báo cho Biz Team ngay sau khi quyết định.',
    'Keywords': 'reject, từ chối, lý do, reason'
  },
  {
    'Topic': 'Yêu cầu bổ sung',
    'Content': 'Khi cần thêm thông tin, liệt kê rõ các thông tin/tài liệu cần bổ sung. Đặt deadline hợp lý (thường 3-5 ngày làm việc).',
    'Keywords': 'bổ sung, yêu cầu, missing, request info'
  }
];

// ==================== CREATE WORKBOOK ====================
const workbook = XLSX.utils.book_new();

// Add sheets
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(approvalPhasesData), 'Approval Phases');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(approvalActionsData), 'Approval Actions');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(commandsData), 'Commands');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(templatesData), 'Templates');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reviewCriteriaData), 'Review Criteria');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(responseFormatsData), 'Response Formats');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(knowledgeBaseData), 'Knowledge Base');

// Save file
const outputPath = path.join(__dirname, 'Compliance_agent_template.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Compliance_agent_template.xlsx đã được tạo tại: ${outputPath}`);
console.log('\n📋 Các sheet trong file:');
console.log('1. Approval Phases - Phase 1: Thẩm định Merchant (chỉ duy nhất phase này)');
console.log('2. Approval Actions - Các action của Compliance agent (review, approve, reject, request_info, history)');
console.log('3. Commands - Các lệnh để tương tác với agent');
console.log('4. Templates - Email templates cho approve/reject/request_info');
console.log('5. Review Criteria - Tiêu chí review cho Phase 1');
console.log('6. Response Formats - Format response cho từng loại response type');
console.log('7. Knowledge Base - Thông tin kiến thức cho agent');