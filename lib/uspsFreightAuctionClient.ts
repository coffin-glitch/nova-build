/**
 * USPS Freight Auction Client
 * Handles HTTP communication with USPS/BlueYonder endpoint
 */

// Base XML template for USPS Freight Auction requests
// This matches the exact format from the browser request
// SYS_ID should be set from environment variable or captured from browser session
const BASE_XML_TEMPLATE = `<REQUEST><AJAX_UPDATE Value="true"/><SAVE_PARAMS Value="false"/><SYS_ID Value="SYS_ID_PLACEHOLDER"/><BUTTON_ID Value="SYS_RELOAD"/><COMPONENT_NBR Value="undefined"/><PAGE_NAME Value="FreightAuction.CarrierView.cfg/xservice/freightauction/workflows/Carrier_View.pgl"/><SUBMIT_AS_XML Value="false"/><PAGE Value="FreightAuction.CarrierView.cfg/xservice/freightauction/workflows/Carrier_View.pgl"/><POPUP_MENU_ROW_ID Value=""/><topContainer_STEP_ID Value="Tab1"/><topContainer_SELECTED_STEP Value="Tab1"/><saveSearchContainer_1_STEP_ID Value=""/><saveSearchContainer_1_SELECTED_STEP Value=""/><SAVED_SEARCH_HIDDEN Value=""/><SAVED_SEARCH_NAME Value=""/><SAVE_SEARCH_AS Value=""/><availableLoadsFilterContainer_STEP_ID Value=""/><availableLoadsFilterContainer_SELECTED_STEP Value=""/><ADVANCED_SEARCH Value=""/><ExternalLoadID Value=""/><StopsInTransit Value=""/><InTransitStops Value=""/><InTransitStops_MATCH_BY Value=""/><OriginLocationDescription Value=""/><OriginCountryCode Value=""/><OriginStateCode Value=""/><OriginCityName Value=""/><DestinationLocationDescription Value=""/><DestinationCountryCode Value=""/><DestinationStateCode Value=""/><DestinationCityName Value=""/><UserDefinedValue01 Value=""/><UserDefinedValue02 Value=""/><UserDefinedValue03 Value=""/><UserDefinedValue04 Value=""/><UserDefinedValue05 Value=""/><UserDefinedValue06 Value=""/><UserDefinedValue07 Value=""/><UserDefinedValue08 Value=""/><UserDefinedValue09 Value=""/><UserDefinedValue10 Value=""/><SourceSystemID Value="1"/><OriginSiteLocationCode Value=""/><AuctionTypeEnumVal Value=""/><ServiceCode Value=""/><FROM_FreightAuctionEntryDateTime_DC Value=""/><TO_FreightAuctionEntryDateTime_DC Value=""/><EquipmentTypeCode Value=""/><FROM_ScheduledPickupDateTime_DC Value=""/><TO_ScheduledPickupDateTime_DC Value=""/><AvailableLoadsCount_N0 Value="TOTAL_ITEMS_PLACEHOLDER"/><CORE_SAVE_REPORT Value=""/><SORT_BY Value="BidLoadID"/><SORT_ORDER Value="Descending"/><START_COUNT Value="START_COUNT_PLACEHOLDER"/><RECORD_COUNT Value="RECORD_COUNT_PLACEHOLDER"/><MAX_ROWS Value="MAX_ROWS_PLACEHOLDER"/><NO_OF_ROWS Value="NO_OF_ROWS_PLACEHOLDER"/><pagenum Value="PAGENUM_PLACEHOLDER"/>RATE_ADJUSTMENT_PLACEHOLDER<DATA><topContainer_STEP_ID Value="Tab1"/><topContainer_SELECTED_STEP Value="Tab1"/><saveSearchContainer_1_STEP_ID Value=""/><saveSearchContainer_1_SELECTED_STEP Value=""/><SAVED_SEARCH_HIDDEN Value=""/><SAVE_SEARCH_AS Value=""/><availableLoadsFilterContainer_STEP_ID Value=""/><availableLoadsFilterContainer_SELECTED_STEP Value=""/><ADVANCED_SEARCH Value=""/><ExternalLoadID Value=""/><StopsInTransit Value=""/><InTransitStops Value=""/><InTransitStops_MATCH_BY Value=""/><OriginLocationDescription Value=""/><OriginCountryCode Value=""/><OriginStateCode Value=""/><OriginCityName Value=""/><DestinationLocationDescription Value=""/><DestinationCountryCode Value=""/><DestinationStateCode Value=""/><DestinationCityName Value=""/><UserDefinedValue01 Value=""/><UserDefinedValue02 Value=""/><UserDefinedValue03 Value=""/><UserDefinedValue04 Value=""/><UserDefinedValue05 Value=""/><UserDefinedValue06 Value=""/><UserDefinedValue07 Value=""/><UserDefinedValue08 Value=""/><UserDefinedValue09 Value=""/><UserDefinedValue10 Value=""/><SourceSystemID Value="1"/><OriginSiteLocationCode Value=""/><AuctionTypeEnumVal Value="ADJUSTED" Selected="false"/><AuctionTypeEnumVal Value="BASE" Selected="false"/><ServiceCode Value="DTTO" Selected="false"/><ServiceCode Value="EXCP" Selected="false"/><ServiceCode Value="SPOT" Selected="false"/><ServiceCode Value="TLFA" Selected="false"/><ServiceCode Value="TL" Selected="false"/><FROM_FreightAuctionEntryDateTime_DC Value=""/><TO_FreightAuctionEntryDateTime_DC Value=""/><EquipmentTypeCode Value=""/><FROM_ScheduledPickupDateTime_DC Value=""/><TO_ScheduledPickupDateTime_DC Value=""/><AvailableLoads><AvailableLoadsCount_N0 Value="TOTAL_ITEMS_PLACEHOLDER"/><CORE_SAVE_REPORT Value=""/><SORT_BY Value="BidLoadID"/><SORT_ORDER Value="Descending"/><START_COUNT OldValue="OLD_START_COUNT_PLACEHOLDER" Value="START_COUNT_PLACEHOLDER"/><RECORD_COUNT Value="RECORD_COUNT_PLACEHOLDER"/><MAX_ROWS Value="MAX_ROWS_PLACEHOLDER"/><NO_OF_ROWS Value="NO_OF_ROWS_PLACEHOLDER"/><availableLoadsTable_globalrowselector Value="on" Checked="false"/>FREIGHT_AUCTION_BID_LOADS_PLACEHOLDER</AvailableLoads></DATA></REQUEST>`;

export interface PaginationInfo {
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

/**
 * Gets the XML template from environment variable or returns the base template
 */
function getXmlTemplate(): string {
  const envTemplate = process.env.USPS_FA_PAGE_XML_TEMPLATE;
  if (envTemplate) {
    return envTemplate;
  }
  return BASE_XML_TEMPLATE;
}

/**
 * Builds the XML request body for a specific page
 */
export function buildUspsXml(
  page: number, 
  startCount: number, 
  pageSize: number = 16,
  totalItems: number = 0,
  oldStartCount: number = 0
): string {
  return buildUspsXmlFromTemplate(BASE_XML_TEMPLATE, page, startCount, pageSize, totalItems, oldStartCount);
}

/**
 * Builds XML from a custom template
 */
export function buildUspsXmlFromTemplate(
  template: string,
  page: number,
  startCount: number,
  pageSize: number = 16,
  totalItems: number = 0,
  oldStartCount: number = 0
): string {
  if (page < 1) {
    throw new Error(`Invalid page number: ${page}. Must be >= 1`);
  }
  if (startCount < 0) {
    throw new Error(`Invalid start count: ${startCount}. Must be >= 0`);
  }

  // Get SYS_ID from env or use placeholder
  const sysId = process.env.USPS_FA_SYS_ID || 'SYS_ID_PLACEHOLDER';

  // For first page, we might not know totalItems yet
  // Use a reasonable default if totalItems is 0 (server will return actual count)
  const totalItemsValue = totalItems > 0 ? String(totalItems) : '30'; // Default to 30 for first request

  // Calculate record count
  // For page 1, RECORD_COUNT should be the total items (or our estimate)
  // For subsequent pages, it should also be the total items
  const recordCount = totalItems > 0 ? totalItems : parseInt(totalItemsValue, 10);

  // pagenum can be empty string for some pages, or the page number
  // Based on the example, it seems to be empty for page 2+
  const pagenumValue = page === 1 ? '1' : '';

  // Generate FreightAuctionBidLoad entries (one per row on the page, up to pageSize)
  // For first page, these can be empty. For subsequent pages, they should contain bid IDs from previous page
  // But since we don't have them yet, we'll use empty placeholders
  const freightAuctionBidLoads = Array.from({ length: pageSize }, (_, i) => 
    `<FreightAuctionBidLoad><SelectedBidID Value="" Checked="false"/><RateAdjustmentAmount_N2 Value=""/></FreightAuctionBidLoad>`
  ).join('');

  // Generate RateAdjustmentAmount_N2 entries (one per row, appears before DATA section)
  const rateAdjustments = Array.from({ length: pageSize }, () => 
    `<RateAdjustmentAmount_N2 Value=""/>`
  ).join('');

  // For page 1, START_COUNT in DATA section should NOT have OldValue attribute
  // For page 2+, it should have OldValue
  // We need to handle this BEFORE replacing other placeholders
  const startCountInDataPattern = /<START_COUNT OldValue="OLD_START_COUNT_PLACEHOLDER" Value="START_COUNT_PLACEHOLDER"\/>/;
  const startCountInData = page === 1
    ? `<START_COUNT Value="START_COUNT_PLACEHOLDER"/>`
    : `<START_COUNT OldValue="OLD_START_COUNT_PLACEHOLDER" Value="START_COUNT_PLACEHOLDER"/>`;

  // Replace START_COUNT in DATA section first (before other replacements)
  let xml = template.replace(startCountInDataPattern, startCountInData);

  // Now replace all other placeholders
  xml = xml
    .replace(/SYS_ID_PLACEHOLDER/g, sysId)
    .replace(/START_COUNT_PLACEHOLDER/g, String(startCount))
    .replace(/OLD_START_COUNT_PLACEHOLDER/g, String(oldStartCount))
    .replace(/RECORD_COUNT_PLACEHOLDER/g, String(recordCount))
    .replace(/MAX_ROWS_PLACEHOLDER/g, String(pageSize))
    .replace(/NO_OF_ROWS_PLACEHOLDER/g, String(pageSize))
    .replace(/PAGENUM_PLACEHOLDER/g, pagenumValue)
    .replace(/TOTAL_ITEMS_PLACEHOLDER/g, totalItemsValue)
    .replace(/RATE_ADJUSTMENT_PLACEHOLDER/g, rateAdjustments)
    .replace(/FREIGHT_AUCTION_BID_LOADS_PLACEHOLDER/g, freightAuctionBidLoads);

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
  const oldStartCount = page > 1 ? (page - 2) * pageSize : 0; // Previous page's start count
  const template = getXmlTemplate();
  
  // For first page, we don't know totalItems yet, so use 0
  // For subsequent pages, we should pass the totalItems from the first page
  // For now, we'll use 0 and let the server return the actual count
  const xmlBody = buildUspsXmlFromTemplate(template, page, startCount, pageSize, 0, oldStartCount);

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
    console.log('[USPS Client] Full XML being sent:');
    console.log(xmlBody);
    console.log('[USPS Client] Headers:', {
      'Content-Type': contentType,
      'Cookie': cookie ? `${cookie.substring(0, 100)}...` : 'NOT SET',
      'User-Agent': userAgent,
      'Referer': referer,
      'Origin': 'https://usps-aztms-sso-pr1.jdadelivers.com',
    });
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

