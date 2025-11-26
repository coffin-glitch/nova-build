/**
 * Script to create custom test bids with specific routes
 */

import 'dotenv/config';
import sql from '../lib/db';

async function createTestBid(
  bidNumber: string,
  stops: string[],
  distance: number
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
      expires_at
    )
    VALUES (
      ${bidNumber},
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
  
  console.log(`✅ Created test bid ${bidNumber}: ${stops.join(' → ')}`);
}

async function main() {
  try {
    // State Match: LOS ANGELES, CA 90052 → GROVEPORT, OH 43125
    await createTestBid(
      '93513961',
      ['LOS ANGELES, CA 90052', 'GROVEPORT, OH 43125'],
      2200 // Approximate distance CA → OH
    );
    
    // Exact Match: SALT LAKE CITY, UT 84199 → AVONDALE, AZ 85323
    await createTestBid(
      '93513733',
      ['SALT LAKE CITY, UT 84199', 'AVONDALE, AZ 85323'],
      650 // Approximate distance UT → AZ
    );
    
    console.log('\n✅ All test bids created successfully!');
    console.log('Now trigger notifications by calling the webhook...');
    
    // Trigger notification processing
    const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/new-bid';
    const webhookKey = process.env.WEBHOOK_API_KEY;
    
    if (webhookKey) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-key': webhookKey,
          },
          body: JSON.stringify({ bidNumber: '93513961' }),
        });
        const result = await response.json();
        console.log('Webhook triggered for 93513961:', result);
        
        // Wait a bit before triggering the second one
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response2 = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-key': webhookKey,
          },
          body: JSON.stringify({ bidNumber: '93513733' }),
        });
        const result2 = await response2.json();
        console.log('Webhook triggered for 93513733:', result2);
      } catch (error) {
        console.warn('Could not trigger webhook (this is okay for local testing):', error);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test bids:', error);
    process.exit(1);
  }
}

main();

