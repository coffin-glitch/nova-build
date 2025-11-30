/**
 * Script to inject test bids for notification system testing
 * Creates 3 test bids that match the notification triggers for dukeisaac12@gmail.com
 * 
 * Usage: npx tsx scripts/inject-notification-test-bids.ts
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

async function createTestBid(
  bidNumber: string,
  stops: string[],
  distance: number,
  description: string
) {
  const now = new Date();
  const pickupTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
  const deliveryTime = new Date(pickupTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours after pickup
  const expiresAt = new Date(now.getTime() + 25 * 60 * 1000); // 25 minutes from now
  
  const stopsJson = JSON.stringify(stops);
  
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
      expires_at,
      is_archived
    )
    VALUES (
      ${bidNumber},
      ${distance},
      ${pickupTime.toISOString()},
      ${deliveryTime.toISOString()},
      ${stopsJson}::jsonb,
      'TEST-NOTIF',
      'test-notification-script',
      ${now.toISOString()},
      ${expiresAt.toISOString()},
      false
    )
    ON CONFLICT (bid_number) DO UPDATE SET
      distance_miles = EXCLUDED.distance_miles,
      pickup_timestamp = EXCLUDED.pickup_timestamp,
      delivery_timestamp = EXCLUDED.delivery_timestamp,
      stops = EXCLUDED.stops,
      tag = EXCLUDED.tag,
      source_channel = EXCLUDED.source_channel,
      received_at = EXCLUDED.received_at,
      expires_at = EXCLUDED.expires_at,
      is_archived = false
  `;
  
  console.log(`✅ Created test bid ${bidNumber}: ${description}`);
  console.log(`   Route: ${stops.join(' → ')}`);
  console.log(`   Distance: ${distance} miles`);
}

async function main() {
  try {
    console.log('🚀 Starting notification test bid injection...\n');
    
    // Generate unique test bid numbers (using different base for each test run)
    // Format: 22222XXXX where XXXX is sequential
    // Change the base number (222220000) for each new test to ensure uniqueness
    const timestamp = Date.now();
    const baseNumber = 222220000; // Changed from 333330000 for this test
    const bid1 = String(baseNumber + 1);
    const bid2 = String(baseNumber + 2);
    const bid3 = String(baseNumber + 3);
    
    // Test Bid 1: State Match - IL → MN
    // Matches: FOREST PARK, IL 60130 → MINNEAPOLIS, MN 55401
    // Using different cities but same states to trigger state match
    await createTestBid(
      bid1,
      ['CHICAGO, IL 60601', 'MINNEAPOLIS, MN 55401'],
      410, // Approximate distance IL → MN
      'State Match: IL → MN (matches FOREST PARK, IL → MINNEAPOLIS, MN)'
    );
    
    // Test Bid 2: Exact Match - PA → KS
    // Matches: HARRISBURG, PA 17604 → OLATHE, KS 66061
    // Using exact same cities to trigger exact match
    await createTestBid(
      bid2,
      ['HARRISBURG, PA 17604', 'OLATHE, KS 66061'],
      1150, // Approximate distance PA → KS
      'Exact Match: HARRISBURG, PA → OLATHE, KS'
    );
    
    // Test Bid 3: State Match - OH → TX
    // Matches: AKRON, OH 44309 → IRVING, TX 75059
    // Using exact same cities to trigger state match (or could use different cities in same states)
    await createTestBid(
      bid3,
      ['AKRON, OH 44309', 'IRVING, TX 75059'],
      1200, // Approximate distance OH → TX
      'State Match: OH → TX (matches AKRON, OH → IRVING, TX)'
    );
    
    console.log('\n✅ All test bids created successfully!');
    console.log('\n📋 Test Bid Summary:');
    console.log(`   #${bid1} - State Match (IL → MN)`);
    console.log(`   #${bid2} - Exact Match (PA → KS)`);
    console.log(`   #${bid3} - State Match (OH → TX)`);
    
    // Trigger webhook for each bid to process notifications
    console.log('\n🔔 Triggering notification webhooks...');
    const webhookUrl = process.env.WEBHOOK_URL 
      || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/new-bid` : null)
      || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/new-bid` : null)
      || 'http://localhost:3000/api/webhooks/new-bid';
    const webhookKey = process.env.WEBHOOK_API_KEY;
    
    console.log(`   Using webhook URL: ${webhookUrl}`);
    
    const testBidNumbers = [bid1, bid2, bid3];
    
    for (const bidNumber of testBidNumbers) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhookKey ? { 'x-webhook-key': webhookKey } : {}),
          },
          body: JSON.stringify({ bidNumber }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`   ✅ Triggered webhook for #${bidNumber}: ${result.message || 'Success'}`);
        } else {
          const error = await response.text();
          console.log(`   ⚠️  Webhook for #${bidNumber} returned ${response.status}: ${error}`);
        }
        
        // Small delay between webhook calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.log(`   ⚠️  Could not trigger webhook for #${bidNumber}: ${error.message}`);
        console.log(`   💡 This is okay - notifications will process on the next worker cycle`);
      }
    }
    
    console.log('\n💡 Notifications should now be processing for dukeisaac12@gmail.com');
    console.log('   Check the notification worker logs to see if they were processed.');
    console.log('\n🗑️  To remove these test bids, run: npx tsx scripts/retract-notification-test-bids.ts');
    console.log('   Or say "retract" to remove them.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test bids:', error);
    process.exit(1);
  }
}

main();

