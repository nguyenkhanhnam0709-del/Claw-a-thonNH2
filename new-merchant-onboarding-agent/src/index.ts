import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import OpenAI from 'openai';
import apiRoutes from './routes/api';
import * as taxLookup from './services/tax-lookup';
import * as emailService from './services/email';
import * as kbService from './services/knowledge-base';
import * as memoryService from './services/memory';
import * as onboardingAgent from './services/onboarding-agent';
import * as formatters from './services/formatters';

const app = express();
const PORT = process.env.PORT || 8080;

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
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

// Validate file type based on phase
function validateFileForPhase(fileName: string, phaseNumber?: number): {
  valid: boolean;
  message: string;
} {
  const fileNameLower = fileName.toLowerCase();
  const phaseRequirements: Record<number, string[]> = {
    1: ['giấy phép kinh doanh', 'gpkd', 'business license', 'certificate', 'đăng ký kinh doanh'],
    2: ['hợp đồng', 'contract', 'draft', 'agreement', 'hd'],
    3: ['tích hợp', 'integration', 'app id', 'api', 'thông tin'],
    4: ['mã số thuế', 'mst', 'tax id', 'bank', 'tài khoản ngân hàng', 'account'],
  };

  if (phaseNumber && phaseRequirements[phaseNumber]) {
    const requirements = phaseRequirements[phaseNumber];
    const matches = requirements.some((req) => fileNameLower.includes(req));
    if (!matches) {
      return {
        valid: false,
        message: `File "${fileName}" có vẻ không phù hợp với Phase ${phaseNumber}. Yêu cầu: ${requirements.join(', ')}`,
      };
    }
  }
  return { valid: true, message: 'File hợp lệ' };
}

// Middleware
app.use(cors());
app.use(express.json());
// index: false so the root route ('/') controls the homepage.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// LLM Configuration (VNG Cloud MaaS - OpenAI compatible)
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = 'https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1';
const LLM_MODEL = 'minimax/minimax-m2.5';

const openai = new OpenAI({
  apiKey: LLM_API_KEY,
  baseURL: LLM_BASE_URL,
});

// System prompt for the BD onboarding agent
const SYSTEM_PROMPT = `Bạn là Merchant Onboarding Agent, hỗ trợ Business Development (BD) tại Zalopay trong quá trình onboarding merchant mới.

## Nhiệm vụ:
- Giải đáp quy trình onboarding cho BD một cách CHUYÊN NGHIỆP, sử dụng markdown formatting đẹp mắt
- Thu thập và kiểm tra tài liệu/thông tin từng phase
- GỬI EMAIL THỰC cho Phase 1, 2, 4
- Tạo Jira ticket cho Phase 3
- Tra cứu mã số thuế (MST) của merchant khi BD yêu cầu

## QUAN TRONG VE FORMAT OUTPUT:
- Khong dung cac ky tu dac biet: =  | # * ---
- Chi su dung text thuan va dau gach ngang (-) cho danh sach
- Tu khoa viet hoa: PIC, PHASE, MERCHANT, EMAIL, TICKET
- Tra loi TIENG VIET CO DAU (có dấu)
- Khi hien thi quy trinh phai dung exact formattedPhases tu tool

## Cach hieu yeu cau BD:

### 1. Khi BD muốn gửi email (Phase 1, 2, 4):
Các cách BD có thể nói:
- "tạo email phase 1/2/4"
- "gửi email cho phase 1/2/4"
- "email thẩm định merchant"
- "gửi mail cho Khoa/TuPNC/ChienNM"
- "review hợp đồng merchant"
- "fa code merchant ABC"
→ HÀNH ĐỘNG: GỬI EMAIL NGAY cho PIC tương ứng, KHÔNG cần xác nhận

### 2. Khi BD nói "tiếp tục", "ok", "đồng ý":
→ HÀNH ĐỘNG: Thực hiện ngay tác vụ trước đó, KHÔNG hỏi lại

### 3. Khi BD muốn tạo ticket (Phase 3):
Các cách BD có thể nói:
- "tạo ticket phase 3"
- "tạo jira ticket"
- "tích hợp thanh toán"
- "tạo app id"
→ HÀNH ĐỘNG: Tạo Jira ticket cho NhanNĐT

### 4. HỌC từ user:
- Khi BD giải thích "ý tôi là...", "đây là...", hãy HỌC và NHỚ
- VD: BD nói "gửi mail cho a Khoa" → BD nói "ý tôi là gửi email Phase 1" → HỌC: "a Khoa" = Phase 1

### 5. Quy tắc trả lời:
- TRẢ LỜI NGẮN GỌN (1-2 câu) nhưng vẫn đẹp bằng markdown
- KHÔNG HỎI NHIỀU CÂU HỎI
- GỬI EMAIL/ TẠO TICKET NGAY khi hiểu ý BD
- NHỚ context của conversation

## Quy trình Onboarding (4 phases):

### Phase 1: Thẩm định Merchant
- Dept: Compliance
- PIC: KhoaNVM (hungnqvng@gmail.com)
- Tasks: Review giấy phép kinh doanh
- BD gửi: Giấy phép kinh doanh Merchant

### Phase 2: Review Hợp đồng
- Dept: Legal
- PIC: TuPNC (vnglegal@gmail.com)
- Tasks: LG review hợp đồng dịch vụ và các điều khoản điều chỉnh từ phía merchant
- BD gửi: Draft hợp đồng (HĐ)

### Phase 3: Tích hợp kỹ thuật
- Dept: Tech
- PIC: NhanNĐT (hieulv3@vng.com.vn)
- Tasks: Tech team tạo App ID và hỗ trợ merchant tích hợp Zalopay Gateway API. Quy trình gồm 2 môi trường: Sandbox (test) và Production.
- BD gửi: Jira ticket cho Tech team

### Phase 4: Tạo FA Code
- Dept: Accounting
- PIC: ChienNM (quochung.ng4801.work@gmail.com)
- Tasks: Tạo PaymentID (Mã FA), Mã thanh toán (P-xxxxx), cấu hình nguồn tiền bank/wallet
- BD gửi: Mã số thuế, tài khoản ngân hàng nhận tiền

## Cách giao tiếp:
- Nói chuyện thân thiện bằng tiếng Việt
- TRẢ LỜI NGẮN GỌN, KHÔNG HỎI NHIỀU CÂU HỎI
- KHÔNG CẦN XÁC NHẬN - GỬI EMAIL NGAY khi BD yêu cầu
- Nhớ các bước đã thực hiện trong conversation - không hỏi lại thông tin đã có
- Khi BD nói "tiếp tục", "ok", "đồng ý" → THỰC HIỆN NGAY tác vụ trước đó
- Khi BD yêu cầu tạo/gửi email cho Phase 1, 2, 4 → GỬI EMAIL NGAY lập tức mà KHÔNG cần xác nhận
  - Phase 1 → Gửi đến KhoaNVM (hungnqvng@gmail.com), subject: "[Onboarding] Thẩm định Merchant - {merchantName}"
  - Phase 2 → Gửi đến TuPNC (vnglegal@gmail.com), subject: "[Onboarding] Review Hợp đồng - {merchantName}"
  - Phase 4 → Gửi đến ChienNM (quochung.ng4801.work@gmail.com), subject: "[Onboarding] Tạo FA Code - {merchantName}"

## Tools available:
- get_phases: Lay danh sach tat ca cac phase (tra ve format phase_list)
- get_phase_detail: Lay chi tiet 1 giai doan cu the (tra ve format phase_detail). Dung khi user hoi "chi tiet giai doan X", "phase X co gi"
- validate_documents: Kiem tra tai lieu BD nop co du khong (tra ve format validation_result)
- generate_email: Tao VA GUI email thuc cho PIC o Phase 1, 2, 4 (tu dong gui email that, tra ve format email_sent)
- generate_ticket: Tao ticket template cho Phase 3 (Tech) (tra ve format ticket_preview)
- send_real_email: Gui email thuc cho nguoi nhan bat ky (su dung Gmail App Password da duoc cau hinh)
- simulate_send_email: Simulate gui email cho PIC (chi log, khong gui that - dung de preview truoc khi gui)
- lookup_tax_id: Tra cuu ma so thue (MST) tu ten cong ty (tra ve format tax_lookup_result)

## QUY TAC OUTPUT (QUAN TRONG NHAT):
- Moi tool tra ve mot field "formatted" (hoac "formattedPhases" cho get_phases). PHAI dung CHINH XAC noi dung field do lam cau tra loi cho user.
- KHONG viet lai, KHONG dien giai them, KHONG bo bot emoji hay dong nao trong "formatted".
- Neu co the chi can xuat nguyen van "formatted"; toi da chi them 1 cau ngan o cuoi neu that su can.`;

// Health check endpoint (required by AgentBase)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== EMAIL ENDPOINTS ====================
app.get('/api/email/auth', (req, res) => {
  try {
    const authUrl = emailService.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/email/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'Thiếu authorization code' });
      return;
    }
    await emailService.setCredentials(code);
    res.json({ success: true, message: 'Đã kết nối Gmail thành công!' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/email/status', (req, res) => {
  const hasCreds = emailService.hasCredentials();
  res.json({ success: true, data: { connected: hasCreds } });
});

app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, body, fromEmail, appPassword } = req.body;
    if (!to || !subject || !body) {
      res.status(400).json({ success: false, error: 'Thiếu to, subject hoặc body' });
      return;
    }
    const result = await emailService.sendEmailSimple(to, subject, body, fromEmail, appPassword);
    res.json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : undefined,
      error: result.error,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Routes (REST alternative + KB routes)
app.use('/api', apiRoutes);

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

// List uploaded files
app.get('/api/files', (req, res) => {
  try {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) {
        res.status(500).json({ success: false, error: 'Không thể đọc danh sách file' });
        return;
      }
      const fileInfos = files.map((file) => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: `/uploads/${file}`, size: stats.size, created: stats.birthtime };
      });
      res.json({ success: true, data: fileInfos });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Tax lookup endpoint
app.post('/api/tax-lookup', async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName) {
      res.status(400).json({ success: false, error: 'Thiếu tên công ty' });
      return;
    }
    const taxInfo = await taxLookup.lookupTaxId(companyName);
    if (taxInfo) {
      res.json({ success: true, data: taxInfo });
    } else {
      res.json({ success: false, error: 'Không tìm thấy thông tin MST cho công ty này' });
    }
  } catch (error: any) {
    console.error('Tax lookup error:', error);
    res.status(500).json({ success: false, error: error.message || 'Lỗi khi tra cứu MST' });
  }
});

// ==================== AI CHAT (BD ONBOARDING) ====================
app.post('/api/chat', upload.single('file'), async (req, res) => {
  try {
    const message = req.body.message || '';
    const ccEmail = (req.body.ccEmail || '').trim(); // CC demo cho giám khảo (tùy chọn)
    // File BD upload sẽ được đính kèm vào email gửi PIC (nếu có)
    const emailAttachments = req.file
      ? [{ filename: req.file.originalname, path: req.file.path }]
      : [];
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

    // Get user/session from headers (provided by AgentBase Runtime); fallback for local dev
    const userId = (req.headers['x-greennode-agentbase-user-id'] as string) || 'default-user';
    const sessionId = (req.headers['x-greennode-agentbase-session-id'] as string) || `session-${Date.now()}`;

    // Memory integration: Search for relevant context
    let memoryContext = '';
    try {
      const relevantRecords = await memoryService.searchMemoryRecords(userId, message, 5);
      if (relevantRecords && relevantRecords.length > 0) {
        memoryContext =
          '\n\n## Thông tin đã học từ trước:\n' + relevantRecords.map((r) => `- ${r.memory}`).join('\n');
      }
    } catch (memError) {
      console.warn('[Memory] Could not search records:', memError);
    }

    let userMessage = message;
    let fileUploadInfo = '';

    const detectPhase = (msg: string): number | undefined => kbService.detectPhase(msg);

    // Check for feedback/learning patterns
    const feedback = kbService.isFeedback(message);
    if (feedback) {
      const phaseFromMeaning = detectPhase(feedback.meaning);
      if (phaseFromMeaning) {
        kbService.learnPhrase(message, phaseFromMeaning, feedback.meaning);
      }
    }

    if (file) {
      const detectedPhase = detectPhase(message);
      const validation = validateFileForPhase(file.originalname, detectedPhase);
      fileUploadInfo = `
[File đính kèm]:
- Tên file: ${file.originalname}
- Kích thước: ${file.size} bytes
- Đường dẫn: ${file.path}
- Trạng thái: ${validation.valid ? '✅ Hợp lệ' : '⚠️ Cảnh báo: ' + validation.message}
`;
      if (!message) {
        userMessage = `Tôi đã upload file "${file.originalname}". Vui lòng kiểm tra và xác nhận file đã được lưu thành công.`;
      }
      userMessage = message + fileUploadInfo;
    }

    // Compress old history if needed
    let compressedContext = context;
    if (context && context.length >= 10) {
      compressedContext = await summarizeOldHistory(context, openai, LLM_MODEL);
    }

    const systemPromptWithMemory = SYSTEM_PROMPT + (memoryContext || '');
    const messages = [
      { role: 'system', content: systemPromptWithMemory },
      ...(compressedContext || []),
      { role: 'user', content: userMessage },
    ];

    // Call LLM with tools
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      temperature: 0.7,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_phases',
            description: 'Tra ve thong tin quy trinh onboarding (format phase_list). Chi tra ve text thuan, KHONG tra ve JSON',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_phase_detail',
            description: 'Lay chi tiet 1 giai doan cu the (format phase_detail). Dung khi user hoi chi tiet/thong tin cua 1 phase',
            parameters: {
              type: 'object',
              properties: {
                phaseNumber: { type: 'number', description: 'Số phase (1-4)' },
              },
              required: ['phaseNumber'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'validate_documents',
            description: 'Kiểm tra xem BD đã nộp đủ tài liệu cần thiết cho một phase chưa',
            parameters: {
              type: 'object',
              properties: {
                phaseNumber: { type: 'number', description: 'Số phase (1-4)' },
                documents: { type: 'array', items: { type: 'string' }, description: 'Danh sách tài liệu BD đã nộp' },
              },
              required: ['phaseNumber', 'documents'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'generate_email',
            description:
              'Tạo VÀ GỬI email thực cho PIC (chỉ dùng cho Phase 1, 2, 4). Email sẽ được gửi ngay sau khi tạo template.',
            parameters: {
              type: 'object',
              properties: {
                phaseNumber: { type: 'number', description: 'Số phase (1, 2, hoặc 4)' },
                merchantName: { type: 'string', description: 'Tên merchant mới' },
                taxId: { type: 'string', description: 'Mã số thuế merchant (Phase 2, 4 - tùy chọn)' },
                bankAccount: { type: 'string', description: 'Tài khoản ngân hàng (Phase 4 - tùy chọn)' },
                bankName: { type: 'string', description: 'Tên ngân hàng (Phase 4 - tùy chọn)' },
              },
              required: ['phaseNumber', 'merchantName'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'generate_ticket',
            description: 'Tạo Jira ticket cho Phase 3 (Tích hợp kỹ thuật)',
            parameters: {
              type: 'object',
              properties: {
                merchantName: { type: 'string', description: 'Tên merchant mới' },
                paymentMethods: {
                  type: 'object',
                  properties: {
                    zalopay: { type: 'boolean' },
                    vqr: { type: 'boolean' },
                    creditCard: { type: 'boolean' },
                  },
                  required: ['zalopay', 'vqr', 'creditCard'],
                },
              },
              required: ['merchantName', 'paymentMethods'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'send_real_email',
            description:
              'Gửi email thực cho người nhận. Sử dụng tool này khi BD yêu cầu gửi email thật (không phải simulate)',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Email người nhận' },
                subject: { type: 'string', description: 'Tiêu đề email' },
                body: { type: 'string', description: 'Nội dung email (HTML allowed)' },
                fromEmail: { type: 'string', description: 'Email người gửi (tùy chọn)' },
                appPassword: { type: 'string', description: 'Gmail App Password (tùy chọn, nếu không dùng OAuth2)' },
              },
              required: ['to', 'subject', 'body'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'simulate_send_email',
            description: 'Simulate gửi email cho PIC (preview, không gửi thật)',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Email người nhận' },
                subject: { type: 'string', description: 'Tiêu đề email' },
                body: { type: 'string', description: 'Nội dung email' },
              },
              required: ['to', 'subject', 'body'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'lookup_tax_id',
            description: 'Tra cứu mã số thuế (MST) của một công ty từ tên công ty qua nguồn masothue.com',
            parameters: {
              type: 'object',
              properties: {
                companyName: { type: 'string', description: 'Tên công ty cần tra cứu MST' },
              },
              required: ['companyName'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls || [];

    if (toolCalls.length > 0) {
      const toolResults: any[] = [];
      const formattedFallbacks: string[] = [];
      for (const toolCall of toolCalls) {
        const func = (toolCall as any).function;
        if (!func) continue;

        const toolName = func.name;
        const toolArgs = JSON.parse(func.arguments);
        const result = await executeTool(toolName, toolArgs, ccEmail, emailAttachments);

        const f = typeof result === 'string' ? result : result?.formatted || result?.formattedPhases;
        if (f) formattedFallbacks.push(f);

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result),
        });
      }

      // Call LLM again with tool results
      const secondResponse = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [...messages, assistantMessage!, ...toolResults],
        temperature: 0.7,
      });

      let finalMessage = sanitizeOutput(secondResponse.choices[0]?.message?.content || '');
      // Nếu LLM trả rỗng (hoặc bị sanitize xoá hết), fallback về output formatted của tool
      if (!finalMessage) {
        finalMessage = formattedFallbacks.filter(Boolean).join('\n\n') || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';
      }

      memoryService.createEvent(userId, sessionId, 'user', userMessage).catch(() => {});
      memoryService.createEvent(userId, sessionId, 'assistant', finalMessage).catch(() => {});

      res.json({
        success: true,
        data: {
          message: finalMessage,
          tools_used: toolCalls.map((tc) => (tc as any).function?.name).filter(Boolean),
        },
      });
    } else {
      let assistantMsg = assistantMessage?.content || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';
      let toolsUsed: string[] = [];

      // Fallback: một số model (MiniMax) đôi khi in tool-call dạng text thay vì gọi đúng cách.
      // Parse, thực thi, và trả về kết quả formatted để demo luôn sạch.
      const inlineCalls = parseInlineToolCalls(assistantMsg);
      if (inlineCalls.length > 0) {
        const outputs: string[] = [];
        for (const c of inlineCalls) {
          const r: any = await executeTool(c.name, c.args, ccEmail, emailAttachments);
          toolsUsed.push(c.name);
          const f = typeof r === 'string' ? r : r?.formatted || r?.formattedPhases;
          if (f) outputs.push(f);
        }
        if (outputs.length > 0) assistantMsg = outputs.join('\n\n');
      }

      assistantMsg = sanitizeOutput(assistantMsg) || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';

      memoryService.createEvent(userId, sessionId, 'user', userMessage).catch(() => {});
      memoryService.createEvent(userId, sessionId, 'assistant', assistantMsg).catch(() => {});

      res.json({
        success: true,
        data: { message: assistantMsg, tools_used: toolsUsed },
      });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message || 'Lỗi khi xử lý yêu cầu' });
  }
});

// ==================== TOOL DISPATCH & OUTPUT SANITIZER ====================
async function executeTool(toolName: string, toolArgs: any, ccEmail?: string, attachments?: any[]): Promise<any> {
  switch (toolName) {
    case 'get_phases':
      return await getPhases();
    case 'get_phase_detail':
      return await getPhaseDetail(toolArgs.phaseNumber);
    case 'validate_documents':
      return await validateDocuments(toolArgs.phaseNumber, toolArgs.documents);
    case 'generate_email':
      return await generateEmail(
        toolArgs.phaseNumber,
        toolArgs.merchantName,
        toolArgs.taxId,
        toolArgs.bankAccount,
        toolArgs.bankName,
        ccEmail,
        attachments
      );
    case 'generate_ticket':
      return await generateTicket(toolArgs.merchantName, toolArgs.paymentMethods);
    case 'send_real_email':
      return await sendRealEmail(toolArgs.to, toolArgs.subject, toolArgs.body, toolArgs.fromEmail, toolArgs.appPassword, ccEmail, attachments);
    case 'simulate_send_email':
      return await simulateSendEmail(toolArgs.to, toolArgs.subject, toolArgs.body);
    case 'lookup_tax_id':
      return await lookupTaxId(toolArgs.companyName);
    default:
      return { error: 'Unknown tool' };
  }
}

// Loại bỏ cú pháp tool-call thô mà model đôi khi lỡ in ra (MiniMax quirk),
// để UI không bao giờ hiển thị <tool_call>/<invoke>/<parameter>.
function sanitizeOutput(text: string): string {
  if (!text) return text;
  let t = text;
  // Cắt sạch từ marker tool-call đầu tiên tới hết (các call thừa luôn nằm cuối,
  // kể cả khi model in thiếu thẻ đóng). Bỏ luôn câu dẫn "Để tôi..." ngay trước nó nếu có.
  const marker = t.search(/<\s*\/?\s*(?:\w+:)?(?:tool_call|invoke|function_call)\b/i);
  if (marker !== -1) {
    let head = t.slice(0, marker);
    head = head.replace(/(?:^|\n)[^\n]*(?:Để tôi|Tôi sẽ|Let me)[^\n]*:\s*$/i, '');
    t = head;
  }
  // Dọn mọi thẻ lẻ còn sót
  t = t.replace(/<\/?(?:\w+:)?(?:tool_call|invoke|parameter|function_call)[^>]*>/gi, '');
  return t.trim();
}

// Parse tool-call khi model in dưới dạng text (fallback). Trả [{name, args}].
function parseInlineToolCalls(content: string): { name: string; args: any }[] {
  const calls: { name: string; args: any }[] = [];
  const invokeRe = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/gi;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(content)) !== null) {
    const name = m[1];
    const body = m[2];
    const args: any = {};
    const paramRe = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/gi;
    let p: RegExpExecArray | null;
    while ((p = paramRe.exec(body)) !== null) {
      const key = p[1];
      let val: any = p[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^-?\d+$/.test(val)) val = Number(val);
      args[key] = val;
    }
    calls.push({ name, args });
  }
  return calls;
}

// ==================== TOOL IMPLEMENTATIONS ====================
async function getPhases() {
  const result = onboardingAgent.getProcessOverview();
  return result.formattedPhases;
}

async function getPhaseDetail(phaseNumber: number) {
  const phase = onboardingAgent.getPhaseByNumber(phaseNumber);
  if (!phase) {
    return { formatted: formatters.formatError('Không tìm thấy giai đoạn', `Phase ${phaseNumber} không tồn tại (chỉ có Phase 1-4).`) };
  }
  return { formatted: formatters.formatPhaseDetail(phase) };
}

async function validateDocuments(phaseNumber: number, documents: string[]) {
  return onboardingAgent.validateDocuments({ phaseNumber, documents });
}

async function generateEmail(
  phaseNumber: number,
  merchantName: string,
  taxId?: string,
  bankAccount?: string,
  bankName?: string,
  ccEmail?: string,
  attachments?: any[]
) {
  const actualMerchantName = merchantName && merchantName.length > 2 ? merchantName : 'Merchant mới';

  const emailTemplate = onboardingAgent.generateEmail({
    phaseNumber,
    merchantInfo: { merchantName: actualMerchantName, taxId, bankAccount, bankName },
  });

  const atts = attachments && attachments.length ? attachments : undefined;
  const sendResult = await emailService.sendEmailSimple(
    emailTemplate.to,
    emailTemplate.subject,
    emailTemplate.body,
    undefined,
    undefined,
    ccEmail || undefined,
    atts
  );

  if (sendResult.success) {
    const sentAt = new Date().toLocaleString('vi-VN');
    const attNames = atts ? atts.map((a: any) => a.filename).join(', ') : undefined;
    return {
      ...emailTemplate,
      sent: true,
      cc: ccEmail || undefined,
      attachments: attNames,
      messageId: sendResult.messageId,
      formatted: formatters.formatEmailSent(emailTemplate.to, emailTemplate.subject, sentAt, ccEmail || undefined, attNames),
    };
  }

  return {
    ...emailTemplate,
    sent: false,
    error: sendResult.error,
    formatted: formatters.formatError('Gửi email thất bại', sendResult.error || 'Lỗi không xác định'),
  };
}

async function generateTicket(merchantName: string, paymentMethods: any) {
  return onboardingAgent.generateTicket({ merchantName, paymentMethods });
}

async function simulateSendEmail(to: string, subject: string, body: string) {
  return onboardingAgent.simulateSendEmail({ email: { to, subject, body } });
}

async function sendRealEmail(to: string, subject: string, body: string, fromEmail?: string, appPassword?: string, ccEmail?: string, attachments?: any[]) {
  const atts = attachments && attachments.length ? attachments : undefined;
  const result = await emailService.sendEmailSimple(to, subject, body, fromEmail, appPassword, ccEmail || undefined, atts);
  if (result.success) {
    const sentAt = new Date().toLocaleString('vi-VN');
    const attNames = atts ? atts.map((a: any) => a.filename).join(', ') : undefined;
    return {
      success: true,
      messageId: result.messageId,
      formatted: formatters.formatEmailSent(to, subject, sentAt, ccEmail || undefined, attNames),
    };
  }
  return { success: false, error: result.error || 'Không thể gửi email', formatted: formatters.formatError('Gửi email thất bại', result.error || 'Lỗi không xác định') };
}

async function lookupTaxId(companyName: string) {
  const result: any = await taxLookup.lookupTaxId(companyName);
  if (result) {
    return {
      found: true,
      ...result,
      formatted: formatters.formatTaxLookup(
        result.companyName || companyName,
        result.mst || '(không có)',
        result.address || '(không có)',
        result.status || '(không có)'
      ),
    };
  }
  return {
    found: false,
    formatted: formatters.formatError('Không tìm thấy MST', `Không tra cứu được mã số thuế cho công ty: ${companyName}`),
  };
}

// Root endpoint — serve the BD onboarding UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ==================== MEMORY ENDPOINTS ====================
app.post('/api/memory/generate', async (req, res) => {
  try {
    const userId = (req.headers['x-greennode-agentbase-user-id'] as string) || 'default-user';
    const sessionId = req.body.sessionId;
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Thiếu sessionId' });
      return;
    }
    const result = await memoryService.generateMemoryRecordsFromSession(userId, sessionId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Memory generate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/memory/records', async (req, res) => {
  try {
    const userId = (req.headers['x-greennode-agentbase-user-id'] as string) || 'default-user';
    const records = await memoryService.listMemoryRecords(userId);
    res.json({ success: true, data: records });
  } catch (error: any) {
    console.error('Memory list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// History summarization (keep context under control)
async function summarizeOldHistory(history: any[], openaiClient: any, model: string) {
  if (history.length < 10) return history;

  const toSummarize = history.slice(0, -4);
  const recent = history.slice(-4);

  try {
    const summary = await openaiClient.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: `Tóm tắt ngắn gọn lịch sử hội thoại này, giữ lại thông tin quan trọng (tên merchant, phase, tài liệu đã nộp):\n${JSON.stringify(
            toSummarize
          )}`,
        },
      ],
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Merchant Onboarding Agent (AI) is running on http://localhost:${PORT}`);
  console.log(`💬 Chat endpoint:`);
  console.log(`   - POST /api/chat                 - BD: Onboard merchant mới`);
  console.log(`📋 REST API endpoints:`);
  console.log(`   - GET  /api/onboarding/phases     - Get all phases`);
  console.log(`   - POST /api/onboarding/validate   - Validate documents`);
  console.log(`   - POST /api/onboarding/email      - Generate email`);
  console.log(`   - POST /api/onboarding/ticket     - Generate ticket`);
  console.log(`   - POST /api/tax-lookup            - Tra cứu MST`);
  console.log(`   - POST /api/email/send            - Gửi email thực`);
});
