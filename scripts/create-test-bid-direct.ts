#!/usr/bin/env tsx
/**
 * Direct script to create a test bid matching exact route and trigger notifications
 * Route: SALT LAKE CITY, UT 84199 → AVONDALE, AZ 85323
 */

import 'dotenv/config';
import sql from '../lib/db';

async function createTestBidAndTrigger() {
  const testBidNumber = `TEST${Date.now()}`;
  const now = new Date();
  const pickupTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const deliveryTime = new Date(pickupTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after pickup
  const expiresAt = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
  
  // Exact route: SALT LAKE CITY, UT 84199 → AVONDALE, AZ 85323
  const stopsArray = ['SALT LAKE CITY, UT 84199', 'AVONDALE, AZ 85323'];
  const stopsJson = JSON.stringify(stopsArray);
  const distance = 650; // Approximate distance
  
  console.log('🧪 Creating test bid for exact match notification\n');
  console.log('📍 Route: SALT LAKE CITY, UT 84199 → AVONDALE, AZ 85323');
  console.log(`📦 Test Bid Number: ${testBidNumber}`);
  console.log(`📏 Distance: ${distance} miles\n`);
  
  try {
    // Insert test bid
    await sql`
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
        ${testBidNumber},
        ${distance},
        ${pickupTime.toISOString()},
        ${deliveryTime.toISOString()},
        ${stopsJson}::jsonb,
        'TEST',
        'test-script',
        ${now.toISOString()},
        ${expiresAt.toISOString()}
      )
      ON CONFLICT (bid_number) DO UPDATE SET
        distance_miles = EXCLUDED.distance_miles,
        pickup_timestamp = EXCLUDED.pickup_timestamp,
        delivery_timestamp = EXCLUDED.delivery_timestamp,
        stops = EXCLUDED.stops,
        tag = EXCLUDED.tag,
        source_channel = EXCLUDED.source_channel,
        received_at = EXCLUDED.received_at,
        expires_at = EXCLUDED.expires_at
    `;
    
    console.log(`✅ Test bid inserted: ${testBidNumber}\n`);
    
    // Trigger webhook
    const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/new-bid';
    const webhookKey = process.env.WEBHOOK_API_KEY;
    
    console.log('🔔 Triggering notification webhook...\n');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (webhookKey) {
      headers['x-webhook-key'] = webhookKey;
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bidNumber: testBidNumber }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook triggered successfully!');
      console.log(`   Users processed: ${data.usersProcessed || 0}`);
      console.log(`   Total triggers: ${data.totalTriggers || 0}`);
      console.log(`\n📧 Check ${process.env.NEXT_PUBLIC_APP_URL ? 'your email' : 'dukeisaac12@gmail.com'} for the notification!`);
      console.log(`\n🧹 To clean up: DELETE FROM telegram_bids WHERE bid_number = '${testBidNumber}';`);
    } else {
      console.log('⚠️  Webhook returned error:', data.error || 'Unknown error');
      console.log('\n💡 Make sure:');
      console.log('   1. Your dev server is running (npm run dev)');
      console.log('   2. WEBHOOK_URL is set in .env.local');
      console.log('   3. WEBHOOK_API_KEY is set in .env.local (if required)');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

createTestBidAndTrigger();

