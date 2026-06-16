import axios from 'axios';

export interface TaxInfo {
  mst: string;
  companyName: string;
  address: string;
  status: string;
  representitive?: string;
  foundingDate?: string;
}

export async function lookupTaxId(companyName: string): Promise<TaxInfo | null> {
  try {
    // Use masothue.com API to search for tax ID
    const searchUrl = `https://masothue.com/api/search?q=${encodeURIComponent(companyName)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    if (response.data && response.data.code === 200 && response.data.data) {
      const data = response.data.data;
      return {
        mst: data.mst || data.tax_code || '',
        companyName: data.name || data.title || companyName,
        address: data.address || '',
        status: data.status || data.trang_thai || '',
        representitive: data.representitive || data.nguoi_dai_dien || '',
        foundingDate: data.founding_date || data.ngay_cap || '',
      };
    }

    return null;
  } catch (error: any) {
    console.error('Error looking up tax ID:', error.message);
    return null;
  }
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