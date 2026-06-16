import fs from 'fs';
import path from 'path';

// Knowledge base file path
const KB_FILE = path.join(__dirname, '..', 'data', 'knowledge-base.json');

// Default knowledge base structure
const DEFAULT_KB = {
  version: '1.0',
  lastUpdated: new Date().toISOString(),
  phases: {
    '1': {
      name: 'Thẩm định Merchant',
      keywords: ['phase 1', 'giai đoạn 1', 'thẩm định', 'giấy phép kinh doanh', 'gpkd', 'business license', 'compliance', 'khoa', 'khoaNVM', 'hungnqvng'],
      action: { type: 'email', to: 'hungnqvng@gmail.com', subject: '[Onboarding] Thẩm định Merchant' }
    },
    '2': {
      name: 'Review Hợp đồng',
      keywords: ['phase 2', 'giai đoạn 2', 'hợp đồng', 'contract', 'legal', 'luật', 'tuPNC', 'namnk'],
      action: { type: 'email', to: 'vnglegal@gmail.com', subject: '[Onboarding] Review Hợp đồng' }
    },
    '3': {
      name: 'Tích hợp kỹ thuật',
      keywords: ['phase 3', 'giai đoạn 3', 'tích hợp', 'kỹ thuật', 'tech', 'ticket', 'jira', 'app id', 'NhanNĐT', 'hieulv3'],
      action: { type: 'ticket', to: 'hieulv3@vng.com.vn', subject: '[Onboarding] Tích hợp thanh toán' }
    },
    '4': {
      name: 'Tạo FA Code',
      keywords: ['phase 4', 'giai đoạn 4', 'fa code', 'mã số thuế', 'mst', 'accounting', 'kế toán', 'ChienNM', 'quochung'],
      action: { type: 'email', to: 'quochung.ng4801.work@gmail.com', subject: '[Onboarding] Tạo FA Code' }
    }
  },
  commands: {
    send_email: ['gửi email', 'send email', 'tạo email', 'create email', 'mail', 'gửi mail', 'email'],
    continue: ['tiếp tục', 'continue', 'ok', 'đồng ý', 'yes', 'vâng', 'được', 'go'],
    upload_file: ['upload', 'file', 'tải lên', 'đính kèm', 'attach'],
    tra_cuu_mst: ['tra cứu mst', 'lookup tax', 'mã số thuế', 'tra thuế'],
    quy_trinh: ['quy trình', 'process', 'các bước', 'steps', 'flow'],
    validate: ['kiểm tra', 'validate', 'check', 'xác nhận']
  },
  // Learned phrases from user feedback
  learned: {}
};

interface KnowledgeBase {
  version: string;
  lastUpdated: string;
  phases: Record<string, {
    name: string;
    keywords: string[];
    action: { type: string; to: string; subject: string };
  }>;
  commands: Record<string, string[]>;
  learned: Record<string, { phase: number; meaning: string; timestamp: string }>;
}

// Load knowledge base from file
function loadKB(): KnowledgeBase {
  try {
    if (fs.existsSync(KB_FILE)) {
      const data = fs.readFileSync(KB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading KB:', error);
  }
  return { ...DEFAULT_KB } as KnowledgeBase;
}

// Save knowledge base to file
function saveKB(kb: KnowledgeBase): void {
  kb.lastUpdated = new Date().toISOString();
  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2), 'utf-8');
}

// In-memory cache
let knowledgeBase: KnowledgeBase | null = null;

/**
 * Get knowledge base (with caching)
 */
export function getKnowledgeBase(): KnowledgeBase {
  if (!knowledgeBase) {
    knowledgeBase = loadKB();
  }
  return knowledgeBase;
}

/**
 * Reload knowledge base from disk
 */
export function reloadKB(): KnowledgeBase {
  knowledgeBase = loadKB();
  return knowledgeBase;
}

/**
 * Detect phase from message
 */
export function detectPhase(message: string): number | undefined {
  const kb = getKnowledgeBase();
  const msgLower = message.toLowerCase();

  // Check learned phrases first
  for (const [phrase, info] of Object.entries(kb.learned)) {
    if (msgLower.includes(phrase.toLowerCase())) {
      return info.phase;
    }
  }

  // Check phase keywords
  for (const [phase, data] of Object.entries(kb.phases)) {
    for (const keyword of data.keywords) {
      if (msgLower.includes(keyword.toLowerCase())) {
        return parseInt(phase);
      }
    }
  }

  return undefined;
}

/**
 * Detect command from message
 */
export function detectCommand(message: string): string | undefined {
  const kb = getKnowledgeBase();
  const msgLower = message.toLowerCase();

  for (const [cmd, keywords] of Object.entries(kb.commands)) {
    for (const keyword of keywords) {
      if (msgLower.includes(keyword.toLowerCase())) {
        return cmd;
      }
    }
  }

  return undefined;
}

/**
 * Check if message is a feedback/learning phrase
 */
export function isFeedback(message: string): { original: string; meaning: string } | null {
  const patterns = [
    /ý\s*tôi\s*là\s*(.+)/i,
    /đây\s*là\s*(.+)/i,
    /nghĩa\s*là\s*(.+)/i,
    /là\s*(.+)\s*nhé/i,
    /tức\s*là\s*(.+)/i,
    /tôi\s*muốn\s*(.+)/i,
    /mình\s*muốn\s*(.+)/i,
    /là\s*gửi\s*email\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return { original: message, meaning: match[1].trim() };
    }
  }

  return null;
}

/**
 * Learn a new phrase from user feedback
 */
export function learnPhrase(phrase: string, phase: number, meaning: string): void {
  const kb = getKnowledgeBase();

  // Add to learned phrases
  kb.learned[phrase.toLowerCase()] = {
    phase,
    meaning,
    timestamp: new Date().toISOString()
  };

  // Also add to phase keywords for faster detection
  if (kb.phases[phase]) {
    if (!kb.phases[phase].keywords.includes(phrase.toLowerCase())) {
      kb.phases[phase].keywords.push(phrase.toLowerCase());
    }
  }

  saveKB(kb);
  knowledgeBase = kb; // Update cache

  console.log(`✅ Learned: "${phrase}" = Phase ${phase} (${meaning})`);
}

/**
 * Add keyword to a phase
 */
export function addKeyword(phase: string, keyword: string): void {
  const kb = getKnowledgeBase();

  if (kb.phases[phase]) {
    if (!kb.phases[phase].keywords.includes(keyword.toLowerCase())) {
      kb.phases[phase].keywords.push(keyword.toLowerCase());
      saveKB(kb);
      knowledgeBase = kb;
      console.log(`✅ Added keyword "${keyword}" to Phase ${phase}`);
    }
  }
}

/**
 * Get all keywords for a phase
 */
export function getKeywords(phase: string): string[] {
  const kb = getKnowledgeBase();
  return kb.phases[phase]?.keywords || [];
}

/**
 * Get learned phrases
 */
export function getLearnedPhrases(): Record<string, any> {
  const kb = getKnowledgeBase();
  return kb.learned || {};
}

/**
 * Clear learned phrases
 */
export function clearLearned(): void {
  const kb = getKnowledgeBase();
  kb.learned = {};
  saveKB(kb);
  knowledgeBase = kb;
  console.log('✅ Cleared all learned phrases');
}