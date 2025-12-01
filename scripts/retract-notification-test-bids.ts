/**
 * Script to retract (delete) all notification test bids
 * Removes test bids that start with 88888 or 99999 (all numeric test bid numbers)
 * 
 * Usage: npx tsx scripts/retract-notification-test-bids.ts
 */

// Load environment variables BEFORE importing db
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then fall back to .env
const envLocal = config({ path: resolve(process.cwd(), '.env.local') });
const env = config({ path: resolve(process.cwd(), '.env') });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local or .env');
  process.exit(1);
}

import sql from '../lib/db';

async function main() {
  try {
    console.log('🗑️  Starting test bid retraction...\n');
    
    // Find all test bids (matching test bid patterns: 5 digits followed by 000 and 1-9)
    // This matches patterns like: 556670001, 334450004, 777770002, etc.
    const testBids = await sql`
      SELECT bid_number, stops, distance_miles
      FROM public.telegram_bids
      WHERE bid_number ~ '^[0-9]{5}000[1-9]$'
         OR bid_number LIKE '88888%'
         OR bid_number LIKE '99999%'
         OR bid_number LIKE '77777%'
         OR bid_number LIKE '66666%'
         OR bid_number LIKE '55555%'
         OR bid_number LIKE '44444%'
         OR bid_number LIKE '33333%'
         OR bid_number LIKE '22222%'
         OR bid_number LIKE '11111%'
         OR bid_number LIKE '00000%'
         OR bid_number LIKE '12345%'
         OR bid_number LIKE '54321%'
         OR bid_number LIKE '98765%'
         OR bid_number LIKE '11223%'
         OR bid_number LIKE '44556%'
         OR bid_number LIKE '77889%'
         OR bid_number LIKE '33445%'
         OR bid_number LIKE '55667%'
      ORDER BY bid_number
    `;
    
    if (testBids.length === 0) {
      console.log('✅ No test bids found to retract.');
      process.exit(0);
    }
    
    console.log(`📋 Found ${testBids.length} test bid(s) to retract:`);
    testBids.forEach((bid: any) => {
      const stops = Array.isArray(bid.stops) ? bid.stops : JSON.parse(bid.stops || '[]');
      const route = stops.length >= 2 
        ? `${stops[0]} → ${stops[stops.length - 1]}`
        : 'Unknown route';
      console.log(`   - #${bid.bid_number}: ${route} (${bid.distance_miles} mi)`);
    });
    
    // Delete all test bids
    const result = await sql`
      DELETE FROM public.telegram_bids
      WHERE bid_number ~ '^[0-9]{5}000[1-9]$'
         OR bid_number LIKE '88888%'
         OR bid_number LIKE '99999%'
         OR bid_number LIKE '77777%'
         OR bid_number LIKE '66666%'
         OR bid_number LIKE '55555%'
         OR bid_number LIKE '44444%'
         OR bid_number LIKE '33333%'
         OR bid_number LIKE '22222%'
         OR bid_number LIKE '11111%'
         OR bid_number LIKE '00000%'
         OR bid_number LIKE '12345%'
         OR bid_number LIKE '54321%'
         OR bid_number LIKE '98765%'
         OR bid_number LIKE '11223%'
         OR bid_number LIKE '44556%'
         OR bid_number LIKE '77889%'
         OR bid_number LIKE '33445%'
         OR bid_number LIKE '55667%'
    `;
    
    const bidNumbers = testBids.map((b: any) => `#${b.bid_number}`).join(', ');
    console.log(`\n✅ Successfully retracted ${testBids.length} test bid(s).`);
    console.log(`   All test bids (${bidNumbers}) have been removed from the system.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error retracting test bids:', error);
    process.exit(1);
  }
}

main();

