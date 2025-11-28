/**
 * Script to retract (delete) all notification test bids
 * Removes test bids: #999990001, #999990002, #999990003
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
    
    // Find all test bids (999990001, 999990002, 999990003)
    const testBids = await sql`
      SELECT bid_number, stops, distance_miles
      FROM public.telegram_bids
      WHERE bid_number IN ('999990001', '999990002', '999990003')
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
      WHERE bid_number IN ('999990001', '999990002', '999990003')
    `;
    
    console.log(`\n✅ Successfully retracted ${testBids.length} test bid(s).`);
    console.log('   All test bids (#999990001, #999990002, #999990003) have been removed from the system.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error retracting test bids:', error);
    process.exit(1);
  }
}

main();

