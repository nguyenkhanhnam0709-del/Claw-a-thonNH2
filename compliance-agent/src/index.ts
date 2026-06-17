import dotenv from 'dotenv';
import * as path from 'path';

// Load .env for local dev (AgentBase injects env vars automatically)
dotenv.config();

console.log('GMAIL_EMAIL:', process.env.GMAIL_EMAIL ? 'set' : 'not set');
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'set' : 'not set');

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as fs from 'fs';

import {
  getApprovalPhases,
  getPhaseByNumber,
  getReviewCriteria,
  detectCommand,
  extractMerchantName,
  extractPhaseNumber,
  extractRejectionReason,
  getPendingRequests,
  getDecisionHistory,
  getAllDecisions,
  approveMerchant,
  rejectMerchant,
  requestMoreInfo,
  formatResponse,
  addPendingRequest
} from './services/compliance-agent';
import { sendEmailAdvanced } from './services/email';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Multer config for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// API: Upload file(s)
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có file nào được upload' });
    }

    const uploadedFiles = files.map(file => ({
      filename: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    console.log(`📤 Uploaded ${files.length} file(s):`, uploadedFiles.map(f => f.filename).join(', '));

    res.json({
      success: true,
      files: uploadedFiles,
      count: files.length
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Get all approval phases
app.get('/api/phases', (req, res) => {
  try {
    const phases = getApprovalPhases();
    res.json(phases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get phase by number
app.get('/api/phases/:number', (req, res) => {
  try {
    const phaseNumber = parseInt(req.params.number);
    const phase = getPhaseByNumber(phaseNumber);
    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    res.json(phase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get review criteria for a phase
app.get('/api/criteria/:phaseNumber', (req, res) => {
  try {
    const phaseNumber = parseInt(req.params.phaseNumber);
    const criteria = getReviewCriteria(phaseNumber);
    res.json(criteria);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get pending requests
app.get('/api/pending', (req, res) => {
  try {
    const pending = getPendingRequests();
    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get decision history
app.get('/api/history/:merchantName', (req, res) => {
  try {
    const merchantName = req.params.merchantName;
    const history = getDecisionHistory(merchantName);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get all decisions
app.get('/api/decisions', (req, res) => {
  try {
    const decisions = getAllDecisions();
    res.json(decisions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Approve merchant
app.post('/api/approve', async (req, res) => {
  try {
    const { merchantName, phaseNumber, notes } = req.body;

    if (!merchantName || !phaseNumber) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin merchantName hoặc phaseNumber' });
    }

    const result = await approveMerchant(merchantName, parseInt(phaseNumber), notes);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Reject merchant
app.post('/api/reject', async (req, res) => {
  try {
    const { merchantName, phaseNumber, reason, requiredDocuments } = req.body;

    if (!merchantName || !phaseNumber || !reason) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
    }

    const result = await rejectMerchant(merchantName, parseInt(phaseNumber), reason, requiredDocuments);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Request more info
app.post('/api/request-info', async (req, res) => {
  try {
    const { merchantName, phaseNumber, missingInfo, message } = req.body;

    if (!merchantName || !phaseNumber || !missingInfo) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
    }

    const result = await requestMoreInfo(merchantName, parseInt(phaseNumber), missingInfo, message);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Add new request from Biz
app.post('/api/request', async (req, res) => {
  try {
    const { merchantName, phaseNumber, documents, requestFrom } = req.body;

    if (!merchantName || !phaseNumber) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin merchantName hoặc phaseNumber' });
    }

    addPendingRequest({
      merchantName,
      phaseNumber: parseInt(phaseNumber),
      decision: 'pending' as any,
      documents: documents || [],
      decidedBy: '',
      decidedAt: new Date().toISOString(),
      requestFrom,
      requestTime: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `✅ Đã tiếp nhận request cho merchant ${merchantName} - Phase ${phaseNumber}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Send email
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, body, cc, bcc, isHTML } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin email (to, subject, body)' });
    }

    const result = await sendEmailAdvanced({
      to,
      subject,
      body,
      cc,
      bcc,
      isHTML
    });

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        response: formatResponse('email_sent', {
          to,
          subject,
          sentAt: new Date().toISOString()
        })?.content || `✅ Email đã được gửi thành công đến ${to}`,
        format: 'text'
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Chat endpoint - Main agent logic
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const msgLower = message.toLowerCase();

    console.log('Chat message:', message);

    // Detect command
    const command = detectCommand(message);
    console.log('Detected command:', command);

    // Extract merchant name and phase
    const merchantName = extractMerchantName(message);
    const phaseNumber = extractPhaseNumber(message);
    console.log('Merchant:', merchantName, 'Phase:', phaseNumber);

    // Handle show pending requests
    if (command === 'xem_yeu_cau' || msgLower.includes('request') || msgLower.includes('yêu cầu') || msgLower.includes('chờ')) {
      const pending = getPendingRequests();
      const pendingList = pending.length > 0
        ? pending.map((p, i) => `${i + 1}. <b>${p.merchantName}</b> - Phase ${p.phaseNumber}<br>   └ Từ: ${p.requestFrom || 'Biz'}`).join('<br><br>')
        : 'Không có request nào đang chờ';

      return res.json({
        response: `<b>📋 Danh sách Request chờ xử lý:</b><br><br>${pendingList}`,
        format: 'html'
      });
    }

    // Handle review
    if (command === 'review' || msgLower.includes('review') || msgLower.includes('kiểm tra')) {
      if (merchantName) {
        const phase = getPhaseByNumber(phaseNumber || 1);
        const criteria = getReviewCriteria(phaseNumber || 1);

        const criteriaList = criteria.map(c =>
          `- ${c.criteria}: ${c.required ? 'Bắt buộc' : 'Tùy chọn'} (${c.weight})`
        ).join('<br>');

        const response = formatResponse('review_result', {
          merchantName,
          phaseNumber: (phaseNumber || 1).toString(),
          status: 'Đang review',
          passedCriteria: '(chưa đánh giá)',
          failedCriteria: criteriaList,
          notes: 'Vui lòng đưa ra quyết định Approve/Reject/Yêu cầu bổ sung'
        });

        return res.json({
          response: response?.content ||
            `<b>📊 Review hồ sơ: ${merchantName}</b><br><br><b>Phase:</b> ${phaseNumber || 1}<br><br><b>Tiêu chí cần kiểm tra:</b><br>${criteriaList}`,
          format: 'html'
        });
      }
    }

    // Handle approve
    if (command === 'approve' || msgLower.includes('approve') || msgLower.includes('duyệt') || msgLower.includes('đồng ý')) {
      if (merchantName) {
        const result = await approveMerchant(merchantName, phaseNumber || 1);

        const response = formatResponse('approval_confirmation', {
          merchantName,
          phaseNumber: (phaseNumber || 1).toString(),
          approvedDate: new Date().toLocaleDateString('vi-VN'),
          notes: ''
        });

        return res.json({
          response: response?.content || result.message,
          format: 'html'
        });
      }
    }

    // Handle reject
    if (command === 'reject' || msgLower.includes('reject') || msgLower.includes('từ chối') || msgLower.includes('không duyệt')) {
      if (merchantName) {
        const reason = extractRejectionReason(message) || 'Không đạt tiêu chí review';
        const result = await rejectMerchant(merchantName, phaseNumber || 1, reason);

        const response = formatResponse('rejection_confirmation', {
          merchantName,
          phaseNumber: (phaseNumber || 1).toString(),
          rejectedDate: new Date().toLocaleDateString('vi-VN'),
          rejectionReason: reason,
          requiredDocuments: ''
        });

        return res.json({
          response: response?.content || result.message,
          format: 'html'
        });
      }
    }

    // Handle request more info
    if (command === 'yeu_cau_bo_sung' || msgLower.includes('bổ sung') || msgLower.includes('yêu cầu thêm')) {
      if (merchantName) {
        // Extract missing info from message
        const missingMatch = message.match(/(?:bổ sung|yêu cầu)[:\s]+(.+)/i);
        const missingInfo = missingMatch ? [missingMatch[1].trim()] : ['Thông tin cần bổ sung'];

        const result = await requestMoreInfo(merchantName, phaseNumber || 1, missingInfo);

        return res.json({
          response: result.message,
          format: 'html'
        });
      }
    }

    // Handle history
    if (command === 'lich_su' || msgLower.includes('lịch sử') || msgLower.includes('history')) {
      if (merchantName) {
        const history = getDecisionHistory(merchantName);

        if (history.length === 0) {
          return res.json({
            response: `📜 Không có lịch sử cho merchant ${merchantName}`,
            format: 'text'
          });
        }

        const historyList = history.map((h, i) =>
          `<b>${i + 1}. ${h.decision.toUpperCase()} - Phase ${h.phaseNumber}</b><br>   └ Ngày: ${new Date(h.decidedAt).toLocaleDateString('vi-VN')}<br>   └ Lý do: ${h.reason || h.notes || '-'}`
        ).join('<br><br>');

        return res.json({
          response: `<b>📜 Lịch sử: ${merchantName}</b><br><br>${historyList}`,
          format: 'html'
        });
      }
    }

    // Handle process/flow
    if (command === 'quy_trinh' || msgLower.includes('quy trình') || msgLower.includes('process')) {
      const phases = getApprovalPhases();
      const phase = phases[0];

      return res.json({
        response: `<b>📋 Quy trình Approval - Compliance</b><br><br><b>Phase 1:</b> Thẩm định Merchant<br>   └ PIC: ${phase?.pic} | Email: ${phase?.picEmail}<br>   └ Yêu cầu: ${phase?.requiredDocuments}<br>   └ Tiêu chí: ${phase?.reviewCriteria}<br><br><b>Lệnh:</b><br>- "review [merchant]" : Review hồ sơ<br>- "approve [merchant]" : Duyệt<br>- "reject [merchant] [lý do]" : Từ chối<br>- "bổ sung [merchant] [thông tin]" : Yêu cầu bổ sung`,
        format: 'html'
      });
    }

    // Handle lookup
    if (command === 'tra_cuu' || msgLower.includes('tra cứu') || msgLower.includes('tìm kiếm')) {
      if (merchantName) {
        const decisions = getAllDecisions().filter(d =>
          d.merchantName.toLowerCase().includes(merchantName.toLowerCase())
        );

        if (decisions.length === 0) {
          return res.json({
            response: `🔍 Không tìm thấy thông tin cho merchant: ${merchantName}`,
            format: 'text'
          });
        }

        const latest = decisions[decisions.length - 1];
        return res.json({
          response: `<b>🔍 Kết quả tra cứu: ${merchantName}</b><br><br><b>Trạng thái:</b> ${latest.decision.toUpperCase()}<br><b>Phase:</b> ${latest.phaseNumber}<br><b>Ngày:</b> ${new Date(latest.decidedAt).toLocaleDateString('vi-VN')}`,
          format: 'html'
        });
      }
    }

    // Default response
    const defaultResponse = `Xin chào! 👋<br><br>Tôi là <b>Compliance Assistant</b>, hỗ trợ bạn trong việc review và approval hồ sơ merchant.<br><br>📋 <b>Tôi có thể giúp bạn:</b><br><br>` +
      `📌 <b>Xem quy trình:</b> "Cho tôi xem quy trình"<br>` +
      `📋 <b>Xem request chờ:</b> "Xem các request đang chờ"<br>` +
      `🔍 <b>Review hồ sơ:</b> "Review merchant ABC"<br>` +
      `✅ <b>Approve:</b> "Approve merchant ABC phase 1"<br>` +
      `❌ <b>Reject:</b> "Reject merchant ABC vì GPKD hết hạn"<br>` +
      `⏳ <b>Yêu cầu bổ sung:</b> "Yêu cầu bổ sung GPKD cho merchant ABC"<br>` +
      `📜 <b>Xem lịch sử:</b> "Xem lịch sử merchant ABC"<br><br>` +
      `Bạn cần hỗ trợ gì?`;

    res.json({
      response: defaultResponse,
      format: 'html'
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    res.json({
      response: `❌ Có lỗi xảy ra: ${error.message}`,
      format: 'text'
    });
  }
});

// API: Get all data (for debugging)
app.get('/api/data', (req, res) => {
  try {
    const { getData } = require('./services/excel-loader');
    const data = getData();
    res.json({
      approvalPhases: data.approvalPhases.length,
      approvalActions: data.approvalActions.length,
      commands: data.commands.length,
      templates: data.templates.length,
      reviewCriteria: data.reviewCriteria.length,
      responseFormats: data.responseFormats.length,
      knowledgeBase: data.knowledgeBase.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: list all templates
app.get('/api/templates', (req, res) => {
  try {
    const { getData } = require('./services/excel-loader');
    const data = getData();
    res.json(data.templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    env: {
      GMAIL_EMAIL: process.env.GMAIL_EMAIL ? 'set' : 'not set',
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'set' : 'not set',
      PORT: process.env.PORT
    }
  });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Zalopay Compliance Agent                        ║
║   POV: Compliance User                                ║
║                                                       ║
║   Local:   http://localhost:${PORT}                    ║
║   API:     http://localhost:${PORT}/api               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;