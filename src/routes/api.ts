import { Router, Request, Response } from 'express';
import * as onboardingAgent from '../services/onboarding-agent';
import * as kbService from '../services/knowledge-base';

const router = Router();

// KB Routes - dùng /kb-info thay vì /kb để tránh conflict với /onboarding/phase/:id
router.get('/kb-info', (req: Request, res: Response) => {
  const kb = kbService.getKnowledgeBase();
  res.json({
    success: true,
    data: {
      phases: Object.keys(kb.phases),
      learnedCount: Object.keys(kb.learned).length,
      lastUpdated: kb.lastUpdated,
    },
  });
});

router.get('/kb-info/learned', (req: Request, res: Response) => {
  const learned = kbService.getLearnedPhrases();
  res.json({
    success: true,
    data: learned,
  });
});

router.post('/kb-info/learn', (req: Request, res: Response) => {
  try {
    const { phrase, phase, meaning } = req.body;

    if (!phrase || !phase) {
      res.status(400).json({ success: false, error: 'Thiếu phrase hoặc phase' });
      return;
    }

    kbService.learnPhrase(phrase, phase, meaning || `Phase ${phase}`);
    res.json({
      success: true,
      message: `Đã học: "${phrase}" = Phase ${phase}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/kb-info/keyword', (req: Request, res: Response) => {
  try {
    const { phase, keyword } = req.body;

    if (!phase || !keyword) {
      res.status(400).json({ success: false, error: 'Thiếu phase hoặc keyword' });
      return;
    }

    kbService.addKeyword(phase.toString(), keyword);
    res.json({
      success: true,
      message: `Đã thêm keyword "${keyword}" vào Phase ${phase}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/kb-info/learned', (req: Request, res: Response) => {
  kbService.clearLearned();
  res.json({
    success: true,
    message: 'Đã xóa tất cả learned phrases',
  });
});

// GET /api/onboarding/phases - Lấy danh sách tất cả các phase
router.get('/onboarding/phases', (req: Request, res: Response) => {
  try {
    const data = onboardingAgent.getProcessOverview();
    res.json({
      success: true,
      data: {
        phases: data.phases,
        useCases: data.useCases,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/onboarding/phase/:id - Lấy chi tiết một phase
router.get('/onboarding/phase/:id', (req: Request, res: Response) => {
  // Skip if it's kb-related routes
  if (req.params.id === 'kb' || req.params.id === 'knowledge') {
    res.status(404).json({
      success: false,
      error: 'Route không tồn tại',
    });
    return;
  }

  try {
    const phaseNumber = parseInt(req.params.id);
    const phase = onboardingAgent.getPhaseByNumber(phaseNumber);

    if (!phase) {
      res.status(404).json({
        success: false,
        error: 'Phase không tồn tại',
      });
      return;
    }

    res.json({
      success: true,
      data: phase,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/onboarding/validate - Validate tài liệu
router.post('/onboarding/validate', (req: Request, res: Response) => {
  try {
    const { phaseNumber, documents } = req.body;

    if (!phaseNumber || !documents) {
      res.status(400).json({
        success: false,
        error: 'Thiếu phaseNumber hoặc documents',
      });
      return;
    }

    const result = onboardingAgent.validateDocuments({ phaseNumber, documents });
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/onboarding/email - Tạo email preview
router.post('/onboarding/email', (req: Request, res: Response) => {
  try {
    const { phaseNumber, merchantInfo } = req.body;

    if (!phaseNumber || !merchantInfo) {
      res.status(400).json({
        success: false,
        error: 'Thiếu phaseNumber hoặc merchantInfo',
      });
      return;
    }

    const email = onboardingAgent.generateEmail({ phaseNumber, merchantInfo });
    res.json({
      success: true,
      data: email,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/onboarding/ticket - Tạo ticket preview
router.post('/onboarding/ticket', (req: Request, res: Response) => {
  try {
    const { merchantName, paymentMethods } = req.body;

    if (!merchantName || !paymentMethods) {
      res.status(400).json({
        success: false,
        error: 'Thiếu merchantName hoặc paymentMethods',
      });
      return;
    }

    const ticket = onboardingAgent.generateTicket({ merchantName, paymentMethods });
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/onboarding/send - Simulate gửi email
router.post('/onboarding/send', (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Thiếu email object',
      });
      return;
    }

    const result = onboardingAgent.simulateSendEmail({ email });
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;