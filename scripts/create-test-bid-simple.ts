#!/usr/bin/env tsx
/**
 * Simple script to create a test bid and trigger notifications
 * Uses the webhook endpoint directly
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function createTestBidAndTrigger() {
  const testBidNumber = `TEST${Date.now()}`;
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/new-bid';
  const webhookKey = process.env.WEBHOOK_API_KEY;
  
  console.log('🧪 Creating test bid for exact match notification\n');
  console.log('📍 Route: SALT LAKE CITY, UT 84199 → AVONDALE, AZ 85323');
  console.log(`📦 Test Bid Number: ${testBidNumber}\n`);
  
  // First, we need to insert the bid into the database
  // We'll use a direct SQL approach via a simple API call or use the database
  // For now, let's create a script that uses the existing database connection
  
  console.log('💡 To complete this test:');
  console.log('   1. Insert the test bid into telegram_bids table');
  console.log('   2. Call the webhook to trigger notifications\n');
  
  console.log('📝 SQL to insert test bid:');
  console.log(`
INSERT INTO public.telegram_bids (
  bid_number,
  distance_miles,
  pickup_timestamp,
  delivery_timestamp,
  stops,
  tag,
  source_channel,
  received_at,
  expires_at
)
VALUES (
  '${testBidNumber}',
  650,
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '26 hours',
  '["SALT LAKE CITY, UT 84199", "AVONDALE, AZ 85323"]'::jsonb,
  'TEST',
  'test-script',
  NOW(),
  NOW() + INTERVAL '25 minutes'
)
ON CONFLICT (bid_number) DO UPDATE SET
  distance_miles = EXCLUDED.distance_miles,
  pickup_timestamp = EXCLUDED.pickup_timestamp,
  delivery_timestamp = EXCLUDED.delivery_timestamp,
  stops = EXCLUDED.stops,
  tag = EXCLUDED.tag,
  source_channel = EXCLUDED.source_channel,
  received_at = EXCLUDED.received_at,
  expires_at = EXCLUDED.expires_at;
  `);
  
  console.log('\n🔔 Then trigger webhook:');
  console.log(`curl -X POST ${webhookUrl} \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  if (webhookKey) {
    console.log(`  -H "x-webhook-key: ${webhookKey}" \\`);
  }
  console.log(`  -d '{"bidNumber": "${testBidNumber}"}'`);
}

createTestBidAndTrigger().catch(console.error);

