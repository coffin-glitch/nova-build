/**
 * USPS Freight Auction Parser
 * Extracts structured data from HTML responses
 */

import * as cheerio from 'cheerio';

export interface ParsedLoad {
  loadId: string;
  roundEndsMinutes: number | null;
  distance: string;
  startDateTimeText: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  rawHtmlRow?: string;
}

/**
 * Parses distance string (e.g., "1,244.9 MILES") to number
 */
function parseDistance(distanceStr: string): number | null {
  if (!distanceStr || !distanceStr.trim()) {
    return null;
  }

  // Remove "MILES" and other text, keep only numbers, commas, and decimal point
  const cleaned = distanceStr
    .replace(/MILES?/gi, '')
    .replace(/[^\d,.]/g, '')
    .replace(/,/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parses datetime string from USPS format to ISO string
 * Handles various formats that might appear in the table
 */
function parseDateTime(dateTimeStr: string): string | null {
  if (!dateTimeStr || !dateTimeStr.trim()) {
    return null;
  }

  const trimmed = dateTimeStr.trim();

  // Try parsing as ISO string first
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  // Try common formats
  // Format: "MM/DD/YYYY HH:MM AM/PM"
  const format1 = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i;
  const match1 = trimmed.match(format1);
  if (match1) {
    const [, month, day, year, hour, minute, ampm] = match1;
    let hour24 = parseInt(hour, 10);
    if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      hour24,
      parseInt(minute, 10)
    );
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Format: "YYYY-MM-DD HH:MM:SS"
  const format2 = /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;
  const match2 = trimmed.match(format2);
  if (match2) {
    const [, year, month, day, hour, minute, second] = match2;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try generic Date parsing as last resort
  const genericDate = new Date(trimmed);
  if (!isNaN(genericDate.getTime())) {
    return genericDate.toISOString();
  }

  console.warn(`[USPS Parser] Could not parse datetime: "${trimmed}"`);
  return null;
}

/**
 * Parses round ends minutes from string
 */
function parseRoundEndsMinutes(roundEndsStr: string): number | null {
  if (!roundEndsStr || !roundEndsStr.trim()) {
    return null;
  }

  // Remove non-numeric characters except minus sign
  const cleaned = roundEndsStr.replace(/[^\d-]/g, '').trim();
  
  if (!cleaned) {
    return null;
  }

  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extracts loads from HTML table
 */
export function parseLoadsFromHtml(html: string): ParsedLoad[] {
  const $ = cheerio.load(html);
  const loads: ParsedLoad[] = [];

  // Find the main table with id="availableLoadsTable"
  const table = $('#availableLoadsTable');
  
  if (table.length === 0) {
    console.warn('[USPS Parser] Could not find table with id="availableLoadsTable"');
    // Try alternative selectors
    const altTable = $('table').first();
    if (altTable.length === 0) {
      console.error('[USPS Parser] No tables found in HTML');
      return loads;
    }
    console.warn('[USPS Parser] Using first table found as fallback');
  }

  const targetTable = table.length > 0 ? table : $('table').first();
  
  // Find all rows (skip header row)
  const rows = targetTable.find('tr').toArray();
  
  if (rows.length === 0) {
    console.warn('[USPS Parser] No rows found in table');
    return loads;
  }

  // Skip first row (header)
  for (let i = 1; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td').toArray();

    if (cells.length < 8) {
      console.warn(`[USPS Parser] Row ${i} has ${cells.length} cells, expected at least 8. Skipping.`);
      continue;
    }

    try {
      // Extract data from cells
      // Column order: Load ID, Round Ends [Minutes], Distance, Start Date/Time, Origin City, Origin State, Destination City, Destination State
      const loadId = $(cells[0]).text().trim();
      const roundEndsStr = $(cells[1]).text().trim();
      const distanceStr = $(cells[2]).text().trim();
      const startDateTimeStr = $(cells[3]).text().trim();
      const originCity = $(cells[4]).text().trim();
      const originState = $(cells[5]).text().trim();
      const destinationCity = $(cells[6]).text().trim();
      const destinationState = $(cells[7]).text().trim();

      // Validate required field
      if (!loadId) {
        console.warn(`[USPS Parser] Row ${i} missing Load ID. Skipping.`);
        continue;
      }

      // Parse fields
      const roundEndsMinutes = parseRoundEndsMinutes(roundEndsStr);
      const distance = distanceStr || '';
      
      // Store raw HTML row for debugging
      const rawHtmlRow = row.html() || undefined;

      const load: ParsedLoad = {
        loadId,
        roundEndsMinutes,
        distance,
        startDateTimeText: startDateTimeStr,
        originCity: originCity || '',
        originState: originState || '',
        destinationCity: destinationCity || '',
        destinationState: destinationState || '',
        rawHtmlRow,
      };

      loads.push(load);
    } catch (error) {
      console.error(`[USPS Parser] Error parsing row ${i}:`, error);
      // Continue with next row
    }
  }

  console.log(`[USPS Parser] Successfully parsed ${loads.length} loads from HTML`);
  return loads;
}

