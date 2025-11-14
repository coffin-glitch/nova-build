/**
 * Test script to send a "pretend" exact match notification
 * This bypasses the matching logic and directly sends a notification email
 * Usage: tsx scripts/test-pretend-exact-match.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import React from 'react';
import { sendEmail } from '../lib/email/notify';
import { ExactMatchNotificationTemplate } from '../lib/email-templates/notification-templates';
import sql from '../lib/db';

async function testPretendExactMatch() {
  console.log('🧪 Testing Pretend Exact Match Notification...\n');

  const testEmail = 'dukeisaac12@gmail.com';
  const userId = '99fcb52a-021a-430b-86cc-e322cdbfffed'; // dukeisaac12@gmail.com
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://novafreight.io';

  // Get one of the user's favorites to use as the "match"
  const favorites = await sql`
    SELECT 
      cf.bid_number,
      tb.stops,
      tb.distance_miles,
      tb.pickup_timestamp,
      tb.delivery_timestamp
    FROM carrier_favorites cf
    JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
    WHERE cf.supabase_carrier_user_id = ${userId}
    ORDER BY cf.created_at DESC
    LIMIT 1
  `;

  if (favorites.length === 0) {
    console.error('❌ No favorites found for user');
    process.exit(1);
  }

  const favorite = favorites[0];
  
  // Parse stops
  let stopsArray: string[] = [];
  if (Array.isArray(favorite.stops)) {
    stopsArray = favorite.stops;
  } else if (typeof favorite.stops === 'string') {
    if (favorite.stops.includes(',')) {
      stopsArray = favorite.stops.split(',').map(s => s.trim());
    } else {
      stopsArray = [favorite.stops];
    }
  }

  const origin = stopsArray[0] || 'Origin';
  const destination = stopsArray[stopsArray.length - 1] || 'Destination';
  const miles = favorite.distance_miles ? parseFloat(favorite.distance_miles) : undefined;
  const stops = stopsArray.length;

  // Format timestamps
  function formatTimestamp(timestamp: Date | string | null | undefined): string | undefined {
    if (!timestamp) return undefined;
    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return undefined;
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      
      const parts = formatter.formatToParts(date);
      const month = parts.find(part => part.type === 'month')?.value;
      const day = parts.find(part => part.type === 'day')?.value;
      const year = parts.find(part => part.type === 'year')?.value;
      const hour = parts.find(part => part.type === 'hour')?.value;
      const minute = parts.find(part => part.type === 'minute')?.value;
      const dayPeriod = parts.find(part => part.type === 'dayPeriod')?.value;
      
      return `${month}/${day}/${year} ${hour}:${minute} ${dayPeriod}`;
    } catch {
      return undefined;
    }
  }

  const pickupTime = formatTimestamp(favorite.pickup_timestamp);
  const deliveryTime = formatTimestamp(favorite.delivery_timestamp);

  // Use a different bid number to simulate a "new match"
  // In reality, this would be a different bid with the same route
  const pretendBidNumber = '91672837'; // Use the bid we tested earlier

  const testData = {
    bidNumber: pretendBidNumber,
    origin,
    destination,
    miles,
    stops,
    pickupTime,
    deliveryTime,
    viewUrl: `${baseUrl}/find-loads?bid=${pretendBidNumber}`,
    carrierName: 'Duke Isaac',
  };

  console.log('📧 Sending PRETEND exact match notification to:', testEmail);
  console.log('📋 Test data:', JSON.stringify(testData, null, 2));
  console.log('');
  console.log('💡 This is a "pretend" match - it simulates finding a new bid');
  console.log(`   that matches your favorite route: ${origin} → ${destination}`);
  console.log('');

  try {
    const reactEmail = React.createElement(ExactMatchNotificationTemplate, testData);

    const result = await sendEmail({
      to: testEmail,
      subject: `🎯 Exact Match Found: ${testData.origin} → ${testData.destination}`,
      react: reactEmail,
    });

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📬 Message ID:', result.messageId);
      console.log('');
      console.log('📧 Check your inbox at:', testEmail);
    } else {
      console.error('❌ Failed to send email:', result.error);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error sending test email:', error);
    process.exit(1);
  }
}

testPretendExactMatch()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

