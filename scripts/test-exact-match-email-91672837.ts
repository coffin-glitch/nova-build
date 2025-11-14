/**
 * Test script to send an exact match notification email for bid #91672837
 * Usage: tsx scripts/test-exact-match-email-91672837.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });
import React from 'react';
import { sendEmail } from '../lib/email/notify';
import { ExactMatchNotificationTemplate } from '../lib/email-templates/notification-templates';
import sql from '../lib/db';

// Helper function to format timestamp (matches telegram bid format)
function formatTimestamp(timestamp: Date | string | null | undefined): string | undefined {
  if (!timestamp) return undefined;
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return undefined;
    
    // Use the same format as formatPickupDateTime from lib/format.ts
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

async function testExactMatchEmail() {
  console.log('🧪 Testing Exact Match Notification Email for Bid #91672837...\n');

  // Debug: Check environment variables
  console.log('🔍 Environment Check:');
  console.log('  EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'not set');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 10)}...` : 'not set');
  console.log('  RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'not set');
  console.log('  ENABLE_EMAIL_NOTIFICATIONS:', process.env.ENABLE_EMAIL_NOTIFICATIONS || 'not set (defaults to true)');
  console.log('');

  const testEmail = 'dukeisaac12@gmail.com';
  const bidNumber = '91672837';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://novafreight.io';

  // Fetch actual bid data from database
  console.log(`📋 Fetching bid data for #${bidNumber}...`);
  const bidData = await sql`
    SELECT 
      bid_number,
      stops,
      distance_miles,
      pickup_timestamp,
      delivery_timestamp,
      tag
    FROM telegram_bids
    WHERE bid_number = ${bidNumber}
    LIMIT 1
  `;

  if (bidData.length === 0) {
    console.error(`❌ Bid #${bidNumber} not found in database`);
    process.exit(1);
  }

  const bid = bidData[0];
  
  // Parse stops array
  let stopsArray: string[] = [];
  if (Array.isArray(bid.stops)) {
    stopsArray = bid.stops;
  } else if (typeof bid.stops === 'string') {
    try {
      const parsed = JSON.parse(bid.stops);
      stopsArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      stopsArray = [bid.stops];
    }
  }

  const origin = stopsArray.length > 0 ? stopsArray[0] : 'Origin';
  const destination = stopsArray.length > 0 ? stopsArray[stopsArray.length - 1] : 'Destination';
  const miles = bid.distance_miles ? parseFloat(bid.distance_miles) : undefined;
  const stops = stopsArray.length;

  // Format timestamps
  const pickupTime = formatTimestamp(bid.pickup_timestamp);
  const deliveryTime = formatTimestamp(bid.delivery_timestamp);

  const testData = {
    bidNumber,
    origin,
    destination,
    miles,
    stops,
    pickupTime,
    deliveryTime,
    viewUrl: `${baseUrl}/find-loads?bid=${bidNumber}`,
    carrierName: 'Duke Isaac',
  };

  console.log('📧 Sending test email to:', testEmail);
  console.log('📋 Test data:', JSON.stringify(testData, null, 2));
  console.log('');

  try {
    // Create the React Email template
    const reactEmail = React.createElement(ExactMatchNotificationTemplate, testData);

    // Send the email
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
      console.log('');
      console.log('📊 Email Details:');
      console.log(`   Bid Number: ${bidNumber}`);
      console.log(`   Route: ${origin} → ${destination}`);
      console.log(`   Distance: ${miles} miles`);
      console.log(`   Stops: ${stops}`);
      console.log(`   Pickup: ${pickupTime || 'N/A'}`);
      console.log(`   Delivery: ${deliveryTime || 'N/A'}`);
    } else {
      console.error('❌ Failed to send email:', result.error);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error sending test email:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testExactMatchEmail()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

