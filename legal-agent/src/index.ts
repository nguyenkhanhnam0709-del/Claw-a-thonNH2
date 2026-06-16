import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import OpenAI from 'openai';
import * as emailService from './services/email';
import * as memoryService from './services/memory';

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== CONTRACT (LEGAL) REVIEW TRACKING ====================
// In-memory contract review status (in production, use a database)
interface ContractReviewStatus {
  merchantName: string;
  bdEmail: string;
  phase: number; // 2 = Review Hợp đồng
  contractVersion?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED' | 'IN_PROGRESS';
  createdAt: string;
  updatedAt: string;
  documents: string[];
  decisionReason?: string;
  legalNotes?: string;
}

const contractReviews: Map<string, ContractReviewStatus> = new Map();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads - save to disk
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Loại file không được hỗ trợ. Vui lòng upload PDF, hình ảnh, hoặc Word.'));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());
// index: false so the root route ('/') controls the homepage (Legal UI) instead of
// express.static auto-serving an index.html.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// ==================== LLM CONFIG ====================
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1';
const LLM_MODEL = 'minimax/minimax-m2.5';

const openai = new OpenAI({
  apiKey: LLM_API_KEY,
  baseURL: LLM_BASE_URL,
});

// ==================== LEGAL AGENT (PHASE 2 - CONTRACT REVIEW) ====================
const LEGAL_SYSTEM_PROMPT = `Bạn là Legal Contract Review Agent, hỗ trợ đội Legal tại Zalopay trong việc rà soát và phê duyệt hợp đồng dịch vụ merchant (Phase 2 - Review Hợp đồng).

## Nhiệm vụ:
- Nhận draft hợp đồng từ BD sau khi Compliance đã phê duyệt Phase 1
- Rà soát các điều khoản hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant
- Quyết định APPROVE / REJECT / REQUEST_REVISION với lý do cụ thể
- Gửi thông báo cho BD khi hoàn thành rà soát

## QUAN TRONG VE FORMAT OUTPUT:
- Khong dung cac ky tu dac biet: =  | # * ---
- Chi su dung text thuan va dau gach ngang (-) cho danh sach
- Tra loi TIENG VIET CO DAU (có dấu)

## Cách xử lý:

### 1. Khi nhận được yêu cầu rà soát hợp đồng:
- Xác nhận đã nhận được draft hợp đồng
- Liệt kê các tài liệu/phụ lục đã nhận
- Thông báo đang tiến hành rà soát điều khoản

### 2. Khi quyết định APPROVE:
- Gửi email xác nhận cho BD
- Thông báo: "Hợp đồng đạt chuẩn pháp lý. BD có thể tiến hành ký kết / Phase 3."
- Cập nhật trạng thái: APPROVED

### 3. Khi quyết định REJECT:
- Nêu rõ lý do từ chối (điều khoản trái luật/chính sách, sai thẩm quyền ký kết, thông tin pháp nhân không khớp, điều khoản điều chỉnh không chấp nhận được)
- Cập nhật trạng thái: REJECTED

### 4. Khi quyết định REQUEST_REVISION (yêu cầu chỉnh sửa):
- Liệt kê CỤ THỂ các điều khoản cần chỉnh sửa / bổ sung kèm comment
- Đề nghị BD/merchant cập nhật và gửi lại
- Cập nhật trạng thái: REVISION_REQUESTED

## Bộ tiêu chí rà soát (Legal Checklist):
- Draft hợp đồng đầy đủ & đúng mẫu
- Thông tin pháp nhân khớp (tên, MST, người đại diện)
- Thẩm quyền ký kết hợp lệ
- Điều khoản dịch vụ & phạm vi rõ ràng
- Điều khoản phí & thanh toán
- Điều khoản trách nhiệm & giới hạn trách nhiệm
- Điều khoản bảo mật & bảo vệ dữ liệu
- Điều khoản chấm dứt & xử lý vi phạm
- Điều khoản giải quyết tranh chấp & luật áp dụng (luật Việt Nam)
- Điều khoản điều chỉnh từ merchant chấp nhận được

## Thông tin Phase 2:
- Dept: Legal
- PIC: TuPNC (namnk@vng.com.vn)
- Tasks: LG review hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant
- Required: Draft hợp đồng (HĐ)

## Tools available:
- get_phases: Lay danh sach tat ca cac phase
- send_legal_approval: Gui thong bao phê duyệt hợp đồng cho BD
- send_legal_rejection: Gui thong bao từ chối hợp đồng cho BD kèm lý do
- send_legal_revision: Gui yêu cầu chỉnh sửa hợp đồng cho BD kèm danh sách điều khoản
- send_real_email: Gui email thực cho BD hoặc người liên quan

## QUY TRAC:
- Phải có action cụ thể (APPROVE/REJECT/REQUEST_REVISION) mới gửi thông báo
- Không tự động approve - phải chờ Legal confirm`;

const LEGAL_TOOLS: any = [
  {
    type: 'function',
    function: {
      name: 'get_phases',
      description: 'Tra ve thong tin quy trinh onboarding',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_legal_approval',
      description: 'Gui thong bao phê duyệt hợp đồng cho BD sau khi Legal confirm',
      parameters: {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Tên merchant' },
          bdEmail: { type: 'string', description: 'Email của BD để thông báo' },
          contractVersion: { type: 'string', description: 'Phiên bản hợp đồng (tùy chọn)' },
          notes: { type: 'string', description: 'Ghi chú thêm (tùy chọn)' },
        },
        required: ['merchantName', 'bdEmail'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_legal_rejection',
      description: 'Gui thong bao từ chối hợp đồng cho BD kèm lý do',
      parameters: {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Tên merchant' },
          bdEmail: { type: 'string', description: 'Email của BD để thông báo' },
          reason: { type: 'string', description: 'Lý do từ chối cụ thể (vd: điều khoản trái luật, sai thẩm quyền ký)' },
          reasonCode: { type: 'string', description: 'Mã lý do chuẩn (REJ-01..REJ-04), tùy chọn' },
        },
        required: ['merchantName', 'bdEmail', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_legal_revision',
      description: 'Gui yêu cầu chỉnh sửa hợp đồng cho BD kèm danh sách điều khoản cần sửa',
      parameters: {
        type: 'object',
        properties: {
          merchantName: { type: 'string', description: 'Tên merchant' },
          bdEmail: { type: 'string', description: 'Email của BD để thông báo' },
          revisionItems: { type: 'array', items: { type: 'string' }, description: 'Danh sách điều khoản cần chỉnh sửa/bổ sung' },
          notes: { type: 'string', description: 'Ghi chú/comment thêm (tùy chọn)' },
        },
        required: ['merchantName', 'bdEmail', 'revisionItems'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_real_email',
      description: 'Gui email thực cho người nhận',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Email người nhận' },
          subject: { type: 'string', description: 'Tiêu đề email' },
          body: { type: 'string', description: 'Nội dung email (HTML allowed)' },
          fromEmail: { type: 'string', description: 'Email người gửi (tùy chọn)' },
          appPassword: { type: 'string', description: 'Gmail App Password (tùy chọn)' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
];

// Health check endpoint (required by AgentBase)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint — this runtime is the Legal agent, so default to the Legal UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'legal.html'));
});

// ==================== TOOL IMPLEMENTATIONS ====================
async function getPhases() {
  return `Quy trình Onboarding Merchant tại Zalopay (4 Phase):

Phase 1: Thẩm định Merchant
- Phòng ban: Compliance | PIC: KhoaNVM
- Nội dung: Review giấy phép kinh doanh và hồ sơ pháp lý của merchant

Phase 2: Review Hợp đồng  (Legal phụ trách)
- Phòng ban: Legal | PIC: TuPNC (namnk@vng.com.vn)
- Nội dung: Rà soát hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant
- Tài liệu BD gửi: Draft hợp đồng

Phase 3: Tích hợp kỹ thuật
- Phòng ban: Tech | PIC: NhanNĐT
- Nội dung: Tạo App ID và hỗ trợ tích hợp Zalopay Gateway API

Phase 4: Tạo FA Code
- Phòng ban: Accounting | PIC: ChienNM
- Nội dung: Tạo PaymentID (Mã FA) và cấu hình nguồn tiền`;
}

async function sendRealEmail(to: string, subject: string, body: string, fromEmail?: string, appPassword?: string) {
  const result = await emailService.sendEmailSimple(to, subject, body, fromEmail, appPassword);
  if (result.success) {
    return {
      success: true,
      messageId: result.messageId,
      message: `Email đã được gửi thành công đến ${to}`,
    };
  }
  return {
    success: false,
    error: result.error || 'Không thể gửi email',
  };
}

// ==================== CONTRACT REVIEW APIs ====================
// List all contract reviews (for Legal pending list)
app.get('/api/contracts/status', (req, res) => {
  const contracts = Array.from(contractReviews.values());
  res.json({ success: true, data: contracts });
});

// Get contract review by merchant name
app.get('/api/contracts/:merchantName/status', (req, res) => {
  const { merchantName } = req.params;
  const status = contractReviews.get(merchantName.toLowerCase());
  if (status) {
    res.json({ success: true, data: status });
  } else {
    res.json({ success: false, error: 'Contract review not found' });
  }
});

// Get pending legal reviews
app.get('/api/legal/pending', (req, res) => {
  const pending = Array.from(contractReviews.values())
    .filter(c => c.phase === 2 && c.status === 'PENDING');
  res.json({ success: true, data: pending });
});

// Submit contract for legal review (called when BD sends Phase 2 request)
app.post('/api/contracts/submit-legal', async (req, res) => {
  try {
    const { merchantName, bdEmail, contractVersion, documents } = req.body;
    if (!merchantName || !bdEmail) {
      res.status(400).json({ success: false, error: 'Thiếu merchantName hoặc bdEmail' });
      return;
    }

    const key = merchantName.toLowerCase();
    const now = new Date().toISOString();
    const status: ContractReviewStatus = {
      merchantName,
      bdEmail,
      phase: 2,
      contractVersion: contractVersion || 'v1.0',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      documents: documents || [],
    };
    contractReviews.set(key, status);

    // Notify Legal team
    const notifySubject = `[Onboarding] Có hợp đồng mới chờ rà soát - ${merchantName}`;
    const notifyBody = `
      <h2>Có hợp đồng merchant mới cần rà soát</h2>
      <p><strong>Merchant:</strong> ${merchantName}</p>
      <p><strong>BD:</strong> ${bdEmail}</p>
      <p><strong>Phiên bản HĐ:</strong> ${status.contractVersion}</p>
      <p><strong>Phase:</strong> 2 - Review Hợp đồng</p>
      <p><strong>Trạng thái:</strong> ⏳ Chờ rà soát</p>
      <hr>
      <p>Vui lòng login vào hệ thống để rà soát.</p>
    `;
    await emailService.sendEmailSimple('vnglegal@gmail.com', notifySubject, notifyBody);

    res.json({ success: true, data: status, message: 'Đã submit hợp đồng cho Legal review và gửi thông báo' });
  } catch (error: any) {
    console.error('Submit legal error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LEGAL CHAT ENDPOINT ====================
app.post('/api/chat/legal', upload.single('file'), async (req, res) => {
  try {
    const message = req.body.message || '';
    let context: any[] = [];
    if (req.body.context) {
      try {
        context = typeof req.body.context === 'string' ? JSON.parse(req.body.context) : req.body.context;
      } catch (e) {
        context = [];
      }
    }
    const file = req.file;

    if (!message && !file) {
      res.status(400).json({ success: false, error: 'Thiếu message hoặc file' });
      return;
    }

    const userId = req.headers['x-greennode-agentbase-user-id'] as string || 'legal-user';
    const sessionId = req.headers['x-greennode-agentbase-session-id'] as string || `legal-${Date.now()}`;

    let userMessage = message;
    if (file) {
      const fileUploadInfo = `
[Tài liệu đính kèm]:
- Tên file: ${file.originalname}
- Kích thước: ${file.size} bytes
- Đường dẫn: ${file.path}
`;
      userMessage = message ? message + fileUploadInfo : `Tôi đã upload file "${file.originalname}" để rà soát hợp đồng.`;
    }

    let compressedContext = context;
    if (context && context.length >= 10) {
      compressedContext = await summarizeOldHistory(context, openai, LLM_MODEL);
    }

    const messages = [
      { role: 'system', content: LEGAL_SYSTEM_PROMPT },
      ...(compressedContext || []),
      { role: 'user', content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      temperature: 0.7,
      tools: LEGAL_TOOLS,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];

    let toolResults: any[] = [];
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const func = (toolCall as any).function;
        if (!func) continue;

        const toolName = func.name;
        const toolArgs = JSON.parse(func.arguments);

        let result: any;
        switch (toolName) {
          case 'get_phases':
            result = await getPhases();
            break;
          case 'send_legal_approval':
            result = await sendLegalApproval(toolArgs.merchantName, toolArgs.bdEmail, toolArgs.contractVersion, toolArgs.notes);
            break;
          case 'send_legal_rejection':
            result = await sendLegalRejection(toolArgs.merchantName, toolArgs.bdEmail, toolArgs.reason, toolArgs.reasonCode);
            break;
          case 'send_legal_revision':
            result = await sendLegalRevision(toolArgs.merchantName, toolArgs.bdEmail, toolArgs.revisionItems, toolArgs.notes);
            break;
          case 'send_real_email':
            result = await sendRealEmail(toolArgs.to, toolArgs.subject, toolArgs.body, toolArgs.fromEmail, toolArgs.appPassword);
            break;
          default:
            result = { error: 'Unknown tool' };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result),
        });
      }

      const secondResponse = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [...messages, assistantMessage!, ...toolResults],
        temperature: 0.7,
      });

      const finalMessage = secondResponse.choices[0]?.message?.content || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';
      memoryService.createEvent(userId, sessionId, 'user', userMessage).catch(() => {});
      memoryService.createEvent(userId, sessionId, 'assistant', finalMessage).catch(() => {});

      res.json({
        success: true,
        data: { message: finalMessage, tools_used: toolCalls.map(tc => (tc as any).function?.name).filter(Boolean) },
      });
    } else {
      const assistantMsg = assistantMessage?.content || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';
      memoryService.createEvent(userId, sessionId, 'user', userMessage).catch(() => {});
      memoryService.createEvent(userId, sessionId, 'assistant', assistantMsg).catch(() => {});

      res.json({ success: true, data: { message: assistantMsg, tools_used: [] } });
    }
  } catch (error: any) {
    console.error('Legal chat error:', error);
    res.status(500).json({ success: false, error: error.message || 'Lỗi khi xử lý yêu cầu' });
  }
});

// ==================== LEGAL REVIEW ACTION ENDPOINT ====================
app.post('/api/legal/review', async (req, res) => {
  try {
    const { merchantName, bdEmail, action, reason, revisionItems, notes } = req.body;
    if (!merchantName || !bdEmail || !action) {
      res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc: merchantName, bdEmail, action' });
      return;
    }
    if (action !== 'approve' && action !== 'reject' && action !== 'revision') {
      res.status(400).json({ success: false, error: 'Action phải là "approve", "reject" hoặc "revision"' });
      return;
    }

    let result;
    if (action === 'approve') {
      result = await sendLegalApproval(merchantName, bdEmail, undefined, notes);
    } else if (action === 'reject') {
      result = await sendLegalRejection(merchantName, bdEmail, reason || 'Không có lý do cụ thể');
    } else {
      const items = Array.isArray(revisionItems)
        ? revisionItems
        : (notes ? notes.split(';').map((s: string) => s.trim()) : []);
      result = await sendLegalRevision(merchantName, bdEmail, items, notes);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Legal review error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LEGAL HELPERS ====================
async function sendLegalApproval(merchantName: string, bdEmail: string, contractVersion?: string, notes?: string) {
  const key = merchantName.toLowerCase();
  const existingStatus = contractReviews.get(key);
  if (existingStatus) {
    existingStatus.status = 'APPROVED';
    existingStatus.updatedAt = new Date().toISOString();
    existingStatus.legalNotes = notes;
    if (contractVersion) existingStatus.contractVersion = contractVersion;
    contractReviews.set(key, existingStatus);
  }

  const subject = `[Legal] ✅ Phê duyệt Hợp đồng (Phase 2) - ${merchantName}`;
  const body = `
    <h2>Thông báo phê duyệt hợp đồng</h2>
    <p>Kính gửi BD,</p>
    <p>Hợp đồng dịch vụ của merchant <strong>${merchantName}</strong> đã được Legal rà soát và <strong>PHÊ DUYỆT</strong>.</p>
    <p><strong>Trạng thái:</strong> ✅ APPROVED</p>
    ${contractVersion ? `<p><strong>Phiên bản HĐ:</strong> ${contractVersion}</p>` : ''}
    <p><strong>Phase 2 hoàn thành!</strong> BD có thể tiến hành ký kết và chuyển sang Phase 3 (Tích hợp kỹ thuật).</p>
    ${notes ? `<p><strong>Ghi chú:</strong> ${notes}</p>` : ''}
    <hr>
    <p>Trân trọng,<br>Legal Team</p>
  `;
  const emailResult = await emailService.sendEmailSimple(bdEmail, subject, body);

  if (emailResult.success) {
    return { action: 'approve', merchantName, bdEmail, status: 'APPROVED', message: `✅ Đã gửi thông báo phê duyệt hợp đồng cho BD (${bdEmail})`, messageId: emailResult.messageId };
  }
  return { action: 'approve', merchantName, bdEmail, status: 'APPROVED', message: `❌ Không thể gửi email: ${emailResult.error}`, error: emailResult.error };
}

async function sendLegalRejection(merchantName: string, bdEmail: string, reason: string, reasonCode?: string) {
  const key = merchantName.toLowerCase();
  const existingStatus = contractReviews.get(key);
  if (existingStatus) {
    existingStatus.status = 'REJECTED';
    existingStatus.updatedAt = new Date().toISOString();
    existingStatus.decisionReason = reason;
    contractReviews.set(key, existingStatus);
  }

  const subject = `[Legal] ❌ Từ chối Hợp đồng (Phase 2) - ${merchantName}`;
  const body = `
    <h2>Thông báo từ chối hợp đồng</h2>
    <p>Kính gửi BD,</p>
    <p>Hợp đồng dịch vụ của merchant <strong>${merchantName}</strong> đã được Legal rà soát và <strong>TỪ CHỐI</strong>.</p>
    <p><strong>Trạng thái:</strong> ❌ REJECTED</p>
    ${reasonCode ? `<p><strong>Mã lý do:</strong> ${reasonCode}</p>` : ''}
    <p><strong>Lý do từ chối:</strong> ${reason}</p>
    <hr>
    <p>Trân trọng,<br>Legal Team</p>
  `;
  const emailResult = await emailService.sendEmailSimple(bdEmail, subject, body);

  if (emailResult.success) {
    return { action: 'reject', merchantName, bdEmail, status: 'REJECTED', reason, message: `✅ Đã gửi thông báo từ chối hợp đồng cho BD (${bdEmail})`, messageId: emailResult.messageId };
  }
  return { action: 'reject', merchantName, bdEmail, status: 'REJECTED', reason, message: `❌ Không thể gửi email: ${emailResult.error}`, error: emailResult.error };
}

async function sendLegalRevision(merchantName: string, bdEmail: string, revisionItems: string[], notes?: string) {
  const key = merchantName.toLowerCase();
  const existingStatus = contractReviews.get(key);
  if (existingStatus) {
    existingStatus.status = 'REVISION_REQUESTED';
    existingStatus.updatedAt = new Date().toISOString();
    existingStatus.legalNotes = notes;
    contractReviews.set(key, existingStatus);
  }

  const itemsText = revisionItems && revisionItems.length > 0
    ? revisionItems.map(i => `- ${i}`).join('<br>')
    : '- Vui lòng liên hệ Legal để biết chi tiết';

  const subject = `[Legal] ✏️ Yêu cầu chỉnh sửa Hợp đồng (Phase 2) - ${merchantName}`;
  const body = `
    <h2>Yêu cầu chỉnh sửa hợp đồng</h2>
    <p>Kính gửi BD,</p>
    <p>Legal đã rà soát hợp đồng dịch vụ của merchant <strong>${merchantName}</strong> và cần chỉnh sửa một số điều khoản.</p>
    <p><strong>Trạng thái:</strong> ✏️ REVISION_REQUESTED</p>
    <p><strong>Các điểm cần chỉnh sửa / bổ sung:</strong><br>${itemsText}</p>
    ${notes ? `<p><strong>Ghi chú:</strong> ${notes}</p>` : ''}
    <p>Sau khi cập nhật, nhờ BD gửi lại để Legal rà soát tiếp.</p>
    <hr>
    <p>Trân trọng,<br>Legal Team</p>
  `;
  const emailResult = await emailService.sendEmailSimple(bdEmail, subject, body);

  if (emailResult.success) {
    return { action: 'revision', merchantName, bdEmail, status: 'REVISION_REQUESTED', revisionItems, message: `✅ Đã gửi yêu cầu chỉnh sửa hợp đồng cho BD (${bdEmail})`, messageId: emailResult.messageId };
  }
  return { action: 'revision', merchantName, bdEmail, status: 'REVISION_REQUESTED', revisionItems, message: `❌ Không thể gửi email: ${emailResult.error}`, error: emailResult.error };
}

// Conversation history compression for long chats
async function summarizeOldHistory(history: any[], openaiClient: any, model: string) {
  if (history.length < 10) return history;

  const toSummarize = history.slice(0, -4);
  const recent = history.slice(-4);

  try {
    const summary = await openaiClient.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: `Summarize this agent conversation history concisely:\n${JSON.stringify(toSummarize)}` }],
      max_tokens: 1000,
      temperature: 0.3,
    });
    const summaryText = summary.choices[0]?.message?.content || '';
    return [{ role: 'assistant', content: `[Lịch sử trước đó]: ${summaryText}` }, ...recent];
  } catch (err) {
    console.warn('[History] Summarization failed, using original history:', err);
    return history;
  }
}

// Multer error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File quá lớn. Vui lòng upload file nhỏ hơn 10MB.' });
    } else {
      res.status(400).json({ success: false, error: err.message });
    }
  } else if (err) {
    res.status(400).json({ success: false, error: err.message });
  } else {
    next();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal Contract Review Agent is running on http://localhost:${PORT}`);
  console.log(`💬 Chat endpoint:`);
  console.log(`   - POST /api/chat/legal               - Legal: Review HĐ & approve/reject/revision`);
  console.log(`📋 API endpoints:`);
  console.log(`   - POST /api/contracts/submit-legal   - Submit HĐ cho Legal review`);
  console.log(`   - GET  /api/contracts/status         - Danh sách HĐ chờ rà soát`);
  console.log(`   - GET  /api/legal/pending            - HĐ đang chờ (PENDING)`);
  console.log(`   - POST /api/legal/review             - Approve/Reject/Revision action`);
});
