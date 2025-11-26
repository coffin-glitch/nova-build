#!/usr/bin/env tsx
/**
 * Cleanup script to remove all test bids from the database
 */

import 'dotenv/config';
import sql from '../lib/db';

async function cleanupTestBids() {
  console.log('🧹 Cleaning up test bids...\n');
  
  try {
    // Delete all test bids
    const result = await sql`
      DELETE FROM public.telegram_bids
      WHERE bid_number LIKE 'TEST%'
         OR source_channel = 'test-script'
    `;
    
    console.log(`✅ Cleaned up test bids`);
    console.log(`   Deleted bids with pattern: TEST% or source_channel = 'test-script'`);
    
  } catch (error: any) {
    console.error('❌ Error cleaning up test bids:', error.message);
    process.exit(1);
  }
}

cleanupTestBids();

