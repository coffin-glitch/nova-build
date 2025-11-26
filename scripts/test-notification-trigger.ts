#!/usr/bin/env tsx
/**
 * Test script to insert a fake bid that matches your test account's alert
 * This will trigger the notification system end-to-end
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import sql from '../lib/db';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

interface TestBid {
  bid_number: string;
  distance_miles: number;
  pickup_timestamp: Date;
  delivery_timestamp: Date;
  stops: string; // JSON string
  tag: string;
  source_channel: string;
  forwarded_to: string | null;
  received_at: Date;
  expires_at: Date;
}

async function getTestAccountTriggers(testEmail?: string) {
  console.log('🔍 Finding test account and active triggers...\n');
  
  let query;
  if (testEmail) {
    query = sql`
      SELECT 
        u.id as user_id,
        u.email,
        nt.id as trigger_id,
        nt.trigger_type,
        nt.trigger_config,
        cf.bid_number as favorite_bid_number,
        tb.stops as favorite_stops,
        tb.distance_miles as favorite_distance
      FROM auth.users u
      JOIN notification_triggers nt ON nt.supabase_carrier_user_id = u.id::text
      LEFT JOIN carrier_favorites cf ON cf.supabase_carrier_user_id = u.id::text
      LEFT JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE u.email = ${testEmail}
        AND nt.is_active = true
        AND nt.trigger_type = 'exact_match'
      ORDER BY nt.id DESC
      LIMIT 1
    `;
  } else {
    // Get any active exact match trigger
    query = sql`
      SELECT 
        u.id as user_id,
        u.email,
        nt.id as trigger_id,
        nt.trigger_type,
        nt.trigger_config,
        cf.bid_number as favorite_bid_number,
        tb.stops as favorite_stops,
        tb.distance_miles as favorite_distance
      FROM auth.users u
      JOIN notification_triggers nt ON nt.supabase_carrier_user_id = u.id::text
      LEFT JOIN carrier_favorites cf ON cf.supabase_carrier_user_id = u.id::text
      LEFT JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
      WHERE nt.is_active = true
        AND nt.trigger_type = 'exact_match'
      ORDER BY nt.id DESC
      LIMIT 1
    `;
  }
  
  const results = await query;
  
  if (results.length === 0) {
    console.log('❌ No active exact match triggers found!');
    console.log('\n💡 To set up a test trigger:');
    console.log('   1. Go to your carrier dashboard');
    console.log('   2. Navigate to Favorites');
    console.log('   3. Favorite a bid');
    console.log('   4. Enable "Exact Match" alert for that favorite');
    return null;
  }
  
  return results[0];
}

function parseStops(stopsString: string | null): Array<{ city: string; state: string }> {
  if (!stopsString) return [];
  
  try {
    const parsed = typeof stopsString === 'string' ? JSON.parse(stopsString) : stopsString;
    if (Array.isArray(parsed)) {
      return parsed.map((stop: any) => {
        if (typeof stop === 'string') {
          // Parse "CITY, STATE" format
          const parts = stop.split(',').map(s => s.trim());
          return { city: parts[0] || '', state: parts[1] || '' };
        }
        return { city: stop.city || '', state: stop.state || '' };
      });
    }
    return [];
  } catch {
    return [];
  }
}

async function createTestBid(trigger: any): Promise<string> {
  console.log('\n📝 Creating test bid that matches your alert...\n');
  
  // Get the favorite route from trigger config or database
  let favoriteStops: Array<{ city: string; state: string }> = [];
  
  if (trigger.trigger_config?.favoriteStops) {
    favoriteStops = parseStops(trigger.trigger_config.favoriteStops);
  } else if (trigger.favorite_stops) {
    favoriteStops = parseStops(trigger.favorite_stops);
  }
  
  if (favoriteStops.length < 2) {
    throw new Error('Could not parse favorite stops. Need at least origin and destination.');
  }
  
  const origin = favoriteStops[0];
  const destination = favoriteStops[favoriteStops.length - 1];
  
  console.log(`📍 Favorite route: ${origin.city}, ${origin.state} → ${destination.city}, ${destination.state}`);
  
  // Create a test bid with the same route
  const testBidNumber = `TEST${Date.now()}`;
  const now = new Date();
  const pickupTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const deliveryTime = new Date(pickupTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after pickup
  const expiresAt = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
  
  // Use the same distance as favorite, or default to 300 miles
  const distance = trigger.favorite_distance || 300;
  
  // Create stops array matching the favorite route
  const stopsArray = favoriteStops.map(s => `${s.city}, ${s.state}`);
  const stopsJson = JSON.stringify(stopsArray);
  
  const testBid: TestBid = {
    bid_number: testBidNumber,
    distance_miles: distance,
    pickup_timestamp: pickupTime,
    delivery_timestamp: deliveryTime,
    stops: stopsJson,
    tag: 'TEST',
    source_channel: 'test-script',
    forwarded_to: null,
    received_at: now,
    expires_at: expiresAt,
  };
  
  console.log(`📦 Test bid details:`);
  console.log(`   Bid Number: ${testBidNumber}`);
  console.log(`   Route: ${stopsArray.join(' → ')}`);
  console.log(`   Distance: ${distance} miles`);
  console.log(`   Pickup: ${pickupTime.toLocaleString()}`);
  console.log(`   Delivery: ${deliveryTime.toLocaleString()}`);
  
  // Insert into database
  await sql`
    INSERT INTO public.telegram_bids (
      bid_number,
      distance_miles,
      pickup_timestamp,
      delivery_timestamp,
      stops,
      tag,
      source_channel,
      forwarded_to,
      received_at,
      expires_at
    )
    VALUES (
      ${testBid.bid_number},
      ${testBid.distance_miles},
      ${testBid.pickup_timestamp},
      ${testBid.delivery_timestamp},
      ${testBid.stops}::jsonb,
      ${testBid.tag},
      ${testBid.source_channel},
      ${testBid.forwarded_to},
      ${testBid.received_at},
      ${testBid.expires_at}
    )
    ON CONFLICT (bid_number) DO UPDATE SET
      distance_miles = EXCLUDED.distance_miles,
      pickup_timestamp = EXCLUDED.pickup_timestamp,
      delivery_timestamp = EXCLUDED.delivery_timestamp,
      stops = EXCLUDED.stops,
      tag = EXCLUDED.tag,
      source_channel = EXCLUDED.source_channel,
      forwarded_to = EXCLUDED.forwarded_to,
      received_at = EXCLUDED.received_at,
      expires_at = EXCLUDED.expires_at
  `;
  
  console.log(`\n✅ Test bid inserted: ${testBidNumber}`);
  
  return testBidNumber;
}

async function triggerWebhook(bidNumber: string) {
  console.log('\n🔔 Triggering notification webhook...\n');
  
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/new-bid';
  const webhookKey = process.env.WEBHOOK_API_KEY;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookKey && { 'x-webhook-key': webhookKey }),
      },
      body: JSON.stringify({ bidNumber }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook triggered successfully!');
      console.log(`   Users processed: ${data.usersProcessed || 0}`);
      console.log(`   Total triggers: ${data.totalTriggers || 0}`);
    } else {
      console.log('⚠️  Webhook returned error:', data.error || 'Unknown error');
    }
    
    return data;
  } catch (error: any) {
    console.log('❌ Failed to trigger webhook:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Your dev server is running (npm run dev)');
    console.log('   2. WEBHOOK_URL is set in .env.local');
    console.log('   3. WEBHOOK_API_KEY is set in .env.local (if required)');
    throw error;
  }
}

async function main() {
  const testEmail = process.argv[2]; // Optional: pass email as argument
  
  console.log('🧪 Notification Test Script');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Find test account trigger
    const trigger = await getTestAccountTriggers(testEmail);
    if (!trigger) {
      process.exit(1);
    }
    
    console.log('✅ Found active trigger:');
    console.log(`   User: ${trigger.email} (${trigger.user_id.substring(0, 8)}...)`);
    console.log(`   Trigger ID: ${trigger.trigger_id}`);
    console.log(`   Type: ${trigger.trigger_type}`);
    console.log(`   Favorite Bid: ${trigger.favorite_bid_number || 'N/A'}`);
    
    // Step 2: Create test bid
    const bidNumber = await createTestBid(trigger);
    
    // Step 3: Trigger webhook
    await triggerWebhook(bidNumber);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test complete!');
    console.log('\n📧 Check your email for the notification.');
    console.log(`📊 Check Railway logs for notification worker activity.`);
    console.log(`\n🧹 To clean up, delete test bid:`);
    console.log(`   DELETE FROM telegram_bids WHERE bid_number = '${bidNumber}';`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

