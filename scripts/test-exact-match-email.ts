/**
 * Test script to send an exact match notification email
 * Usage: tsx scripts/test-exact-match-email.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });
import { sendEmail } from '../lib/email/notify';
import { ExactMatchNotificationTemplate } from '../lib/email-templates/notification-templates';
import * as React from 'react';

async function testExactMatchEmail() {
  console.log('🧪 Testing Exact Match Notification Email...\n');

  // Debug: Check environment variables
  console.log('🔍 Environment Check:');
  console.log('  EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'not set');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 10)}...` : 'not set');
  console.log('  RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'not set');
  console.log('  ENABLE_EMAIL_NOTIFICATIONS:', process.env.ENABLE_EMAIL_NOTIFICATIONS || 'not set (defaults to true)');
  console.log('');

  const testEmail = 'dukeisaac12@gmail.com';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://novafreight.io';

  // Use actual bid #91671821 data from database
  // Bid #91671821: SANDSTON, VA → HOPE MILLS, NC
  // Pickup: 11/10/2025 10:00 PM (CST) = 11/11/2025 03:00 UTC
  // Delivery: 11/11/2025 04:06 AM (CST) = 11/11/2025 09:06 UTC
  // Distance: 218 miles, Stops: 2
  const testData = {
    bidNumber: '91671821',
    origin: 'SANDSTON, VA',
    destination: 'HOPE MILLS, NC',
    miles: 218,
    stops: 2,
    pickupTime: '11/10/2025 10:00 PM',
    deliveryTime: '11/11/2025 04:06 AM',
    viewUrl: `${baseUrl}/find-loads?bid=91671821`,
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

