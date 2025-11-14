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

  // Simulate an exact match notification
  const testData = {
    bidNumber: '12345',
    origin: 'Los Angeles, CA',
    destination: 'New York, NY',
    revenue: 4500,
    miles: 2789,
    stops: 1,
    pickupTime: '11/14/2025 08:00 AM',
    deliveryTime: '11/16/2025 06:00 PM',
    viewUrl: `${baseUrl}/find-loads?bid=12345`,
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

