/**
 * USPS Freight Auction Database Layer
 * Maps parsed loads to telegram_bids table format
 */

import sql from './db';
import type { ParsedLoad } from './uspsFreightAuctionParser';

export interface MappedTelegramBid {
  bid_number: string;
  distance_miles: number | null;
  pickup_timestamp: string | null;
  delivery_timestamp: string | null;
  stops: string[];
  tag: string | null;
  source_channel: string;
  received_at: string;
  expires_at: string | null;
  raw_text?: string;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  errors: Array<{ loadId: string; error: string }>;
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
 * Parses datetime string to ISO timestamp
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

  return null;
}

/**
 * Calculates delivery timestamp (estimated: pickup + 1 day)
 */
function calculateDeliveryTimestamp(pickupTimestamp: string | null): string | null {
  if (!pickupTimestamp) {
    return null;
  }

  const pickupDate = new Date(pickupTimestamp);
  if (isNaN(pickupDate.getTime())) {
    return null;
  }

  // Add 1 day as estimate
  const deliveryDate = new Date(pickupDate);
  deliveryDate.setDate(deliveryDate.getDate() + 1);

  return deliveryDate.toISOString();
}

/**
 * Calculates expires_at from roundEndsMinutes
 */
function calculateExpiresAt(receivedAt: string, roundEndsMinutes: number | null): string | null {
  if (roundEndsMinutes === null || roundEndsMinutes < 0) {
    return null;
  }

  const receivedDate = new Date(receivedAt);
  if (isNaN(receivedDate.getTime())) {
    return null;
  }

  // Add minutes to received_at
  const expiresDate = new Date(receivedDate);
  expiresDate.setMinutes(expiresDate.getMinutes() + roundEndsMinutes);

  return expiresDate.toISOString();
}

/**
 * Extracts state tag from origin or destination state
 */
function extractTag(originState: string, destinationState: string): string | null {
  // Use origin state as tag, or destination if origin is empty
  const tag = originState || destinationState || null;
  return tag ? tag.toUpperCase().trim() : null;
}

/**
 * Maps a ParsedLoad to TelegramBid format
 */
export function mapParsedLoadToTelegramBid(load: ParsedLoad): MappedTelegramBid {
  const receivedAt = new Date().toISOString();
  const distanceMiles = parseDistance(load.distance);
  const pickupTimestamp = parseDateTime(load.startDateTimeText);
  const deliveryTimestamp = calculateDeliveryTimestamp(pickupTimestamp);
  const expiresAt = calculateExpiresAt(receivedAt, load.roundEndsMinutes);

  // Create stops array: [origin, destination]
  const stops: string[] = [];
  if (load.originCity && load.originState) {
    stops.push(`${load.originCity}, ${load.originState}`);
  }
  if (load.destinationCity && load.destinationState) {
    stops.push(`${load.destinationCity}, ${load.destinationState}`);
  }

  // Extract tag from state
  const tag = extractTag(load.originState, load.destinationState);

  return {
    bid_number: load.loadId,
    distance_miles: distanceMiles,
    pickup_timestamp: pickupTimestamp,
    delivery_timestamp: deliveryTimestamp,
    stops: stops.length > 0 ? stops : [],
    tag,
    source_channel: 'usps_freight_auction',
    received_at: receivedAt,
    expires_at: expiresAt,
    raw_text: load.rawHtmlRow,
  };
}

/**
 * Upserts loads into telegram_bids table
 * On conflict, updates all fields EXCEPT received_at (preserves original discovery time)
 */
export async function upsertLoads(loads: ParsedLoad[]): Promise<UpsertResult> {
  const result: UpsertResult = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  if (loads.length === 0) {
    return result;
  }

  console.log(`[USPS DB] Upserting ${loads.length} loads into telegram_bids...`);

  // Process loads in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < loads.length; i += batchSize) {
    const batch = loads.slice(i, i + batchSize);

    for (const load of batch) {
      try {
        const mapped = mapParsedLoadToTelegramBid(load);

        // Check if bid_number already exists
        const existing = await sql`
          SELECT id, received_at FROM telegram_bids 
          WHERE bid_number = ${mapped.bid_number} 
          LIMIT 1
        `;

        if (existing.length > 0) {
          // Update existing record (preserve original received_at)
          await sql`
            UPDATE telegram_bids
            SET
              distance_miles = ${mapped.distance_miles},
              pickup_timestamp = ${mapped.pickup_timestamp},
              delivery_timestamp = ${mapped.delivery_timestamp},
              stops = ${JSON.stringify(mapped.stops)}::jsonb,
              tag = ${mapped.tag},
              source_channel = ${mapped.source_channel},
              expires_at = ${mapped.expires_at},
              raw_text = ${mapped.raw_text}
            WHERE bid_number = ${mapped.bid_number}
          `;
          result.updated++;
        } else {
          // Insert new record
          await sql`
            INSERT INTO telegram_bids (
              bid_number,
              distance_miles,
              pickup_timestamp,
              delivery_timestamp,
              stops,
              tag,
              source_channel,
              received_at,
              expires_at,
              raw_text,
              published
            ) VALUES (
              ${mapped.bid_number},
              ${mapped.distance_miles},
              ${mapped.pickup_timestamp},
              ${mapped.delivery_timestamp},
              ${JSON.stringify(mapped.stops)}::jsonb,
              ${mapped.tag},
              ${mapped.source_channel},
              ${mapped.received_at},
              ${mapped.expires_at},
              ${mapped.raw_text},
              true
            )
          `;
          result.inserted++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[USPS DB] Error upserting load ${load.loadId}:`, errorMessage);
        result.errors.push({
          loadId: load.loadId,
          error: errorMessage,
        });
      }
    }
  }

  console.log(
    `[USPS DB] Upsert complete: ${result.inserted} inserted, ${result.updated} updated, ${result.errors.length} errors`
  );

  return result;
}

