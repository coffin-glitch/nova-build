/**
 * Test script for USPS Freight Auction sync endpoint
 * 
 * Usage:
 *   tsx scripts/test-usps-sync.ts
 * 
 * Or with service key:
 *   USPS_FA_SERVICE_KEY=your-key tsx scripts/test-usps-sync.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SERVICE_KEY = process.env.USPS_FA_SERVICE_KEY;

async function testSync() {
  console.log('🚀 Testing USPS Freight Auction Sync...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Service Key: ${SERVICE_KEY ? '✅ Set' : '❌ Not set (will use admin auth)'}\n`);

  const url = `${BASE_URL}/api/usps-freight-auction/sync`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Use service key if available
  if (SERVICE_KEY) {
    headers['x-service-key'] = SERVICE_KEY;
    console.log('Using service key authentication...\n');
  } else {
    console.log('⚠️  No service key found. You need to be authenticated as admin.');
    console.log('   Option 1: Set USPS_FA_SERVICE_KEY in .env.local (recommended for cron)');
    console.log('   Option 2: Test via browser while logged in as admin');
    console.log('   Option 3: Get your Supabase session cookie from browser DevTools\n');
    console.log('   To get session cookie:');
    console.log('   1. Open browser DevTools (F12)');
    console.log('   2. Go to Application tab → Cookies → your-domain');
    console.log('   3. Find cookie starting with "sb-" (Supabase session)');
    console.log('   4. Copy the cookie value and add to request\n');
  }

  try {
    console.log(`📡 Sending POST request to ${url}...\n`);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    const duration = Date.now() - startTime;
    const result = await response.json();

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Duration: ${duration}ms\n`);

    if (response.ok) {
      console.log('✅ Sync successful!\n');
      console.log('Results:');
      console.log(`  - Total Pages: ${result.totalPages}`);
      console.log(`  - Total Loads: ${result.totalLoads}`);
      console.log(`  - New Loads: ${result.newLoads}`);
      console.log(`  - Updated Loads: ${result.updatedLoads}`);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`  - Errors: ${result.errors.length}`);
        result.errors.forEach((error: any, index: number) => {
          console.log(`    ${index + 1}. Load ${error.loadId}: ${error.error}`);
        });
      } else {
        console.log(`  - Errors: 0`);
      }
      
      console.log(`\n💾 Check your database:`);
      console.log(`   SELECT * FROM telegram_bids WHERE source_channel = 'usps_freight_auction' ORDER BY received_at DESC LIMIT 10;`);
    } else {
      console.log('❌ Sync failed!\n');
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', result.details);
      }
      
      if (response.status === 401) {
        console.log('\n💡 Authentication failed. Options:');
        console.log('   1. Set USPS_FA_SERVICE_KEY in .env.local');
        console.log('   2. Get your admin session cookie from browser');
        console.log('   3. Test via browser while logged in as admin');
      }
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testSync().catch(console.error);

