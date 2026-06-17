import axios from 'axios';

export interface TaxInfo {
  mst: string;
  companyName: string;
  address: string;
  status: string;
  representitive?: string;
  foundingDate?: string;
}

// DEMO MODE: trả dữ liệu mô phỏng ổn định cho mỗi tên công ty (không gọi API thật).
// Đủ để demo luồng tra cứu MST end-to-end. Để bật tra cứu thật, dùng lookupTaxIdByScraping
// hoặc khôi phục lời gọi masothue.com bên dưới.
export async function lookupTaxId(companyName: string): Promise<TaxInfo | null> {
  const name = (companyName || '').trim() || 'Doanh nghiệp';

  // Hash tên công ty -> MST 10 chữ số ổn định (cùng tên luôn ra cùng MST)
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const mst = String(1000000000 + (h % 9000000000)); // 10 chữ số

  return {
    mst,
    companyName: name,
    address: 'TP. Hồ Chí Minh, Việt Nam',
    status: 'Đang hoạt động',
    representitive: '',
    foundingDate: '',
  };
}

// Alternative: Use web scraping approach
export async function lookupTaxIdByScraping(companyName: string): Promise<TaxInfo | null> {
  try {
    // First, get the search page to get csrf token
    const searchUrl = `https://masothue.com/${encodeURIComponent(companyName)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });

    // Parse HTML response to extract data
    const html = response.data;

    // Look for tax code in the HTML
    const mstMatch = html.match(/(\d{10,13})/);
    const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const addressMatch = html.match(/Địa chỉ:\s*([^<]+)/);
    const statusMatch = html.match(/Trạng thái:\s*([^<]+)/);

    if (mstMatch) {
      return {
        mst: mstMatch[1],
        companyName: nameMatch ? nameMatch[1].trim() : companyName,
        address: addressMatch ? addressMatch[1].trim() : '',
        status: statusMatch ? statusMatch[1].trim() : 'Hoạt động',
      };
    }

    return null;
  } catch (error: any) {
    console.error('Error looking up tax ID (scraping):', error.message);
    return null;
  }
}

// Simple tax ID validation (Vietnam format)
export function validateTaxId(taxId: string): boolean {
  // Vietnamese MST format: 10 or 13 digits
  const cleanMst = taxId.replace(/[^0-9]/g, '');
  return cleanMst.length === 10 || cleanMst.length === 13;
}

// Extract MST from text
export function extractTaxIdFromText(text: string): string | null {
  // Look for 10 or 13 digit numbers
  const match = text.match(/\b(\d{10,13})\b/);
  return match ? match[1] : null;
}