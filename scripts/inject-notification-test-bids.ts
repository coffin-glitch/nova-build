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
  
  // Pass stops array directly as JSONB - DO NOT stringify!
  // Stringifying creates a JSONB string, not a JSONB array
  // The postgres library will automatically convert JavaScript arrays to JSONB
  
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
      ${stops}::jsonb,
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
    // Format: 55667XXXX where XXXX is sequential
    // Change the base number (556670000) for each new test to ensure uniqueness
    const timestamp = Date.now();
    const baseNumber = 556670000; // Changed from 334450000 for stress test - using 55667 prefix
    
    // Original 3 test bids (State Match and Exact Match)
    const bid1 = String(baseNumber + 1); // 334450001 - State Match IL → MN
    const bid2 = String(baseNumber + 2); // 334450002 - Exact Match PA → KS
    const bid3 = String(baseNumber + 3); // 334450003 - State Match OH → TX
    
    // State Preference test bids (3 out of 4 states: CT, IL, UT - leaving out KY)
    const bid4 = String(baseNumber + 4); // 334450004 - State Preference CT
    const bid5 = String(baseNumber + 5); // 334450005 - State Preference IL
    const bid6 = String(baseNumber + 6); // 334450006 - State Preference UT
    
    // Backhaul test bids (reverse routes for backhaul matching)
    const bid7 = String(baseNumber + 7); // 334450007 - Backhaul Exact Match (KS → PA, reverse of PA → KS)
    const bid8 = String(baseNumber + 8); // 334450008 - Backhaul State Match (MN → IL, reverse of IL → MN)
    
    // Test bid to verify state preference fix (should NOT match IL preference)
    const bid9 = String(baseNumber + 9); // 334450009 - False positive test (HOPE MILLS, NC - contains "IL" in city name but state is NC)
    
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
    
    // Test Bid 4: State Preference - CT (Connecticut)
    // Should trigger state preference notification (CT is in user's state preferences)
    await createTestBid(
      bid4,
      ['HARTFORD, CT 06103', 'BOSTON, MA 02101'],
      100, // Short distance test
      'State Preference: CT (matches user state preference)'
    );
    
    // Test Bid 5: State Preference - IL (Illinois)
    // Should trigger state preference notification (IL is in user's state preferences)
    await createTestBid(
      bid5,
      ['SPRINGFIELD, IL 62701', 'INDIANAPOLIS, IN 46201'],
      200, // Medium distance test
      'State Preference: IL (matches user state preference)'
    );
    
    // Test Bid 6: State Preference - UT (Utah)
    // Should trigger state preference notification (UT is in user's state preferences)
    await createTestBid(
      bid6,
      ['SALT LAKE CITY, UT 84101', 'DENVER, CO 80201'],
      500, // Medium distance test
      'State Preference: UT (matches user state preference)'
    );
    
    // Test Bid 7: Backhaul Exact Match - KS → PA
    // Reverse route of exact match (PA → KS) to test backhaul matching
    // Should trigger backhaul exact match notification
    await createTestBid(
      bid7,
      ['OLATHE, KS 66061', 'HARRISBURG, PA 17604'],
      1150, // Same distance (reverse route)
      'Backhaul Exact Match: KS → PA (reverse of PA → KS)'
    );
    
    // Test Bid 8: Backhaul State Match - MN → IL
    // Reverse route of state match (IL → MN) to test backhaul state matching
    // Should trigger backhaul state match notification
    await createTestBid(
      bid8,
      ['MINNEAPOLIS, MN 55401', 'CHICAGO, IL 60601'],
      410, // Same distance (reverse route)
      'Backhaul State Match: MN → IL (reverse of IL → MN)'
    );
    
    // Test Bid 9: False Positive Test - HOPE MILLS, NC
    // City name contains "IL" (MILLS) but state is NC
    // Should NOT trigger state preference notification for IL
    // This tests the fix for state preference matching (only match state part, not city names)
    await createTestBid(
      bid9,
      ['HOPE MILLS, NC 28348', 'RALEIGH, NC 27601'],
      50, // Short distance
      'False Positive Test: HOPE MILLS, NC (contains IL in city name but state is NC - should NOT match IL preference)'
    );
    
    console.log('\n✅ All test bids created successfully!');
    console.log('\n📋 Test Bid Summary:');
    console.log(`   #${bid1} - State Match (IL → MN)`);
    console.log(`   #${bid2} - Exact Match (PA → KS)`);
    console.log(`   #${bid3} - State Match (OH → TX)`);
    console.log(`   #${bid4} - State Preference (CT)`);
    console.log(`   #${bid5} - State Preference (IL)`);
    console.log(`   #${bid6} - State Preference (UT)`);
    console.log(`   #${bid7} - Backhaul Exact Match (KS → PA)`);
    console.log(`   #${bid8} - Backhaul State Match (MN → IL)`);
    console.log(`   #${bid9} - False Positive Test (HOPE MILLS, NC - should NOT match IL)`);
    
    // Trigger webhook for each bid to process notifications
    console.log('\n🔔 Triggering notification webhooks...');
    const webhookUrl = process.env.WEBHOOK_URL 
      || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/new-bid` : null)
      || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/new-bid` : null)
      || 'http://localhost:3000/api/webhooks/new-bid';
    const webhookKey = process.env.WEBHOOK_API_KEY;
    
    console.log(`   Using webhook URL: ${webhookUrl}`);
    
    const testBidNumbers = [bid1, bid2, bid3, bid4, bid5, bid6];
    
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

