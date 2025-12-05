/**
 * USPS Freight Auction Client
 * Handles HTTP communication with USPS/BlueYonder endpoint
 */

// Base XML template for USPS Freight Auction requests
// This is a simplified version - you may need to adjust based on actual request format
const BASE_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<REQUEST>
  <AJAX_UPDATE Value="true"/>
  <SAVE_PARAMS Value="false"/>
  <SYS_ID Value="1^CarrierView.3^WORKFLOW-1654283171764950899393_2076397853^939e8f10-67b0-47fa-abdd-d090357590e1"/>
  <BUTTON_ID Value="SYS_RELOAD"/>
  <COMPONENT_NBR Value="undefined"/>
  <PAGE_NAME Value="FreightAuction.CarrierView.cfg/xservice/freightauction/workflows/Carrier_View.pgl"/>
  <SUBMIT_AS_XML Value="false"/>
  <PAGE Value="FreightAuction.CarrierView.cfg/xservice/freightauction/workflows/Carrier_View.pgl"/>
  <SORT_BY Value="BidLoadID"/>
  <SORT_ORDER Value="Descending"/>
  <START_COUNT Value="0"/>
  <RECORD_COUNT Value="41"/>
  <MAX_ROWS Value="16"/>
  <NO_OF_ROWS Value="16"/>
  <pagenum Value="1"/>
  <DATA>
    <AvailableLoads>
      <AvailableLoadsCount_N0 Value="41"/>
      <CORE_SAVE_REPORT Value=""/>
      <SORT_BY Value="BidLoadID"/>
      <SORT_ORDER Value="Descending"/>
      <START_COUNT Value="0"/>
      <RECORD_COUNT Value="41"/>
      <MAX_ROWS Value="16"/>
      <NO_OF_ROWS Value="16"/>
      <availableLoadsTable_globalrowselector Value="on" Checked="false"/>
    </AvailableLoads>
  </DATA>
</REQUEST>`;

export interface PaginationInfo {
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

/**
 * Builds the XML request body for a specific page
 */
export function buildUspsXml(page: number, startCount: number, pageSize: number = 16): string {
  return buildUspsXmlFromTemplate(BASE_XML_TEMPLATE, page, startCount, pageSize);
}

/**
 * Builds XML from a custom template
 */
export function buildUspsXmlFromTemplate(
  template: string,
  page: number,
  startCount: number,
  pageSize: number = 16
): string {
  if (page < 1) {
    throw new Error(`Invalid page number: ${page}. Must be >= 1`);
  }
  if (startCount < 0) {
    throw new Error(`Invalid start count: ${startCount}. Must be >= 0`);
  }

  // Replace pagination values in the XML template
  // Use global replace to update all occurrences
  let xml = template
    .replace(/<START_COUNT Value="[^"]*"\/>/g, `<START_COUNT Value="${startCount}"/>`)
    .replace(/<pagenum Value="[^"]*"\/>/g, `<pagenum Value="${page}"/>`)
    .replace(/<MAX_ROWS Value="[^"]*"\/>/g, `<MAX_ROWS Value="${pageSize}"/>`)
    .replace(/<NO_OF_ROWS Value="[^"]*"\/>/g, `<NO_OF_ROWS Value="${pageSize}"/>`);

  return xml;
}

/**
 * Fetches a single page of HTML from the USPS endpoint
 */
export async function fetchPageHtml(
  page: number,
  pageSize: number = 16,
  retryCount: number = 0
): Promise<string> {
  const maxRetries = 3;
  const baseUrl = process.env.USPS_FA_BASE_URL;
  const cookie = process.env.USPS_FA_COOKIE;
  const userAgent = process.env.USPS_FA_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
  const referer = process.env.USPS_FA_REFERER || 'https://usps-aztms-sso-pr1.jdadelivers.com/tm/framework/Frame.jsp';
  const contentType = process.env.USPS_FA_CONTENT_TYPE || 'text/xml';

  if (!baseUrl) {
    throw new Error('USPS_FA_BASE_URL environment variable is not set');
  }
  if (!cookie) {
    throw new Error('USPS_FA_COOKIE environment variable is not set');
  }

  const startCount = (page - 1) * pageSize;
  const template = getXmlTemplate();
  const xmlBody = buildUspsXmlFromTemplate(template, page, startCount, pageSize);

  // Generate correlation IDs (UUIDs)
  // Use a simple UUID v4 generator if crypto.randomUUID is not available
  function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  
  const correlationId = generateUUID();
  const correlationGroupId = generateUUID();

  // Build URL - check if baseUrl already has query params
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}X-Correlation-Id=${correlationId}&X-Correlation-Group-Id=${correlationGroupId}&action=SYS_RELOAD`;

  // Log request details for debugging (first request only)
  if (page === 1 && retryCount === 0) {
    console.log('[USPS Client] Making request to:', url);
    console.log('[USPS Client] XML body length:', xmlBody.length);
    console.log('[USPS Client] XML preview:', xmlBody.substring(0, 500));
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Cookie': cookie,
        'User-Agent': userAgent,
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Origin': 'https://usps-aztms-sso-pr1.jdadelivers.com',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: xmlBody,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      const errorPreview = errorText.length > 1000 ? errorText.substring(0, 1000) + '...' : errorText;
      
      // Log full error for debugging
      console.error(`[USPS Client] HTTP ${response.status} error for page ${page}:`);
      console.error(`[USPS Client] Response preview:`, errorPreview);
      console.error(`[USPS Client] Request URL:`, url);
      console.error(`[USPS Client] Request headers:`, {
        'Content-Type': contentType,
        'Cookie': cookie ? `${cookie.substring(0, 50)}...` : 'NOT SET',
        'User-Agent': userAgent,
        'Referer': referer,
      });
      
      throw new Error(
        `HTTP error! status: ${response.status}, statusText: ${response.statusText}\n${errorPreview}`
      );
    }

    const html = await response.text();
    
    if (!html || html.trim().length === 0) {
      throw new Error('Received empty response from USPS endpoint');
    }

    return html;
  } catch (error) {
    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.warn(
        `[USPS Client] Request failed for page ${page}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`,
        error instanceof Error ? error.message : String(error)
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchPageHtml(page, pageSize, retryCount + 1);
    }

    // All retries exhausted
    console.error(`[USPS Client] Failed to fetch page ${page} after ${maxRetries} retries:`, error);
    throw error;
  }
}

/**
 * Extracts pagination information from HTML
 */
export function getTotalPagesFromHtml(html: string): PaginationInfo {
  const cheerio = require('cheerio') as typeof import('cheerio');
  const $ = cheerio.load(html);

  // Find the hidden input fields
  const totalItemsInput = $('input[name="AvailableLoadsCount_N0"]');
  const maxRowsInput = $('input[name="MAX_ROWS"]');

  let totalItems = 0;
  let pageSize = 16; // Default

  if (totalItemsInput.length > 0) {
    const value = totalItemsInput.attr('value');
    if (value) {
      totalItems = parseInt(value, 10);
      if (isNaN(totalItems)) {
        console.warn('[USPS Client] Could not parse AvailableLoadsCount_N0 value:', value);
        totalItems = 0;
      }
    }
  }

  if (maxRowsInput.length > 0) {
    const value = maxRowsInput.attr('value');
    if (value) {
      pageSize = parseInt(value, 10);
      if (isNaN(pageSize)) {
        console.warn('[USPS Client] Could not parse MAX_ROWS value:', value);
        pageSize = 16;
      }
    }
  }

  // Also try to find pagination text like "Page 1 of 3"
  const pageText = $('body').text();
  const pageMatch = pageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  if (pageMatch && pageMatch[2]) {
    const parsedTotalPages = parseInt(pageMatch[2], 10);
    if (!isNaN(parsedTotalPages)) {
      // Use this to validate our calculation
      const calculatedTotalPages = Math.ceil(totalItems / pageSize);
      if (calculatedTotalPages !== parsedTotalPages && totalItems > 0) {
        console.warn(
          `[USPS Client] Pagination mismatch: calculated ${calculatedTotalPages}, found in text ${parsedTotalPages}`
        );
      }
    }
  }

  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;

  if (totalItems === 0) {
    console.warn('[USPS Client] Could not determine total items, defaulting to 1 page');
  }

  return {
    totalPages,
    totalItems,
    pageSize,
  };
}

/**
 * Fetches all pages of HTML from the USPS endpoint
 */
export async function fetchAllPagesHtml(
  concurrencyLimit: number = 3
): Promise<string[]> {
  console.log('[USPS Client] Starting to fetch all pages...');

  // Fetch page 1 first to get pagination info
  const firstPageHtml = await fetchPageHtml(1);
  const paginationInfo = getTotalPagesFromHtml(firstPageHtml);

  console.log(`[USPS Client] Found ${paginationInfo.totalItems} total items across ${paginationInfo.totalPages} pages (${paginationInfo.pageSize} per page)`);

  const allPages: string[] = [firstPageHtml];

  if (paginationInfo.totalPages <= 1) {
    console.log('[USPS Client] Only one page, returning early');
    return allPages;
  }

  // Fetch remaining pages with concurrency limit
  const remainingPages = Array.from({ length: paginationInfo.totalPages - 1 }, (_, i) => i + 2);
  const errors: Array<{ page: number; error: string }> = [];

  // Process pages in batches
  for (let i = 0; i < remainingPages.length; i += concurrencyLimit) {
    const batch = remainingPages.slice(i, i + concurrencyLimit);
    
    const batchPromises = batch.map(async (page) => {
      try {
        console.log(`[USPS Client] Fetching page ${page}/${paginationInfo.totalPages}...`);
        const html = await fetchPageHtml(page, paginationInfo.pageSize);
        return { page, html, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[USPS Client] Failed to fetch page ${page}:`, errorMessage);
        errors.push({ page, error: errorMessage });
        return { page, html: null, success: false };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Add successful pages to results
    for (const result of batchResults) {
      if (result.success && result.html) {
        allPages.push(result.html);
      }
    }

    // Small delay between batches to avoid overwhelming the server
    if (i + concurrencyLimit < remainingPages.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (errors.length > 0) {
    console.warn(`[USPS Client] Completed with ${errors.length} errors out of ${paginationInfo.totalPages} pages`);
    console.warn('[USPS Client] Errors:', errors);
  } else {
    console.log(`[USPS Client] Successfully fetched all ${paginationInfo.totalPages} pages`);
  }

  return allPages;
}

