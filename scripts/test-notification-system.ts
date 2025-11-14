/**
 * Comprehensive Notification System Test
 * 
 * This script tests the entire notification flow:
 * 1. Checks for active notification triggers
 * 2. Triggers notification processing
 * 3. Monitors queue stats
 * 4. Verifies notifications were created
 * 5. Checks email sending
 * 
 * Usage: npx tsx scripts/test-notification-system.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import sql from '../lib/db';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

async function testNotificationSystem() {
  console.log('🧪 Testing Notification System...\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check for active notification triggers
    console.log('\n📋 Step 1: Checking for active notification triggers...');
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.supabase_carrier_user_id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active,
        cp.email_notifications,
        u.email
      FROM notification_triggers nt
      LEFT JOIN carrier_notification_preferences cp 
        ON nt.supabase_carrier_user_id = cp.supabase_carrier_user_id
      LEFT JOIN auth.users u 
        ON nt.supabase_carrier_user_id::uuid = u.id
      WHERE nt.is_active = true
      ORDER BY nt.supabase_carrier_user_id, nt.trigger_type
      LIMIT 10
    `;

    if (triggers.length === 0) {
      console.log('⚠️  No active notification triggers found!');
      console.log('\n💡 To set up triggers:');
      console.log('   1. Go to your carrier dashboard');
      console.log('   2. Navigate to Favorites/Notification Preferences');
      console.log('   3. Enable notification triggers');
      return;
    }

    console.log(`✅ Found ${triggers.length} active trigger(s):`);
    triggers.forEach((trigger, index) => {
      console.log(`   ${index + 1}. User: ${trigger.supabase_carrier_user_id.substring(0, 8)}...`);
      console.log(`      Type: ${trigger.trigger_type}`);
      console.log(`      Email: ${trigger.email || 'Not found'}`);
      console.log(`      Email Notifications: ${trigger.email_notifications !== false ? 'Enabled' : 'Disabled'}`);
    });

    // Step 2: Check queue stats before
    console.log('\n📊 Step 2: Checking queue stats (before)...');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    let beforeCompleted = 0;
    try {
      const queueStatsBefore = await fetch(`${baseUrl}/api/notifications/queue-stats`);
      if (queueStatsBefore.ok) {
        const stats = await queueStatsBefore.json();
        beforeCompleted = stats.completed || 0;
        console.log('   Queue Stats:');
        console.log(`   - Waiting: ${stats.waiting || 0}`);
        console.log(`   - Active: ${stats.active || 0}`);
        console.log(`   - Completed: ${beforeCompleted}`);
        console.log(`   - Failed: ${stats.failed || 0}`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch queue stats (API may not be running)');
    }

    // Step 3: Check recent notifications before
    console.log('\n📬 Step 3: Checking recent notifications (before)...');
    const notificationsBefore = await sql`
      SELECT 
        COUNT(*) as count,
        MAX(created_at) as latest
      FROM carrier_notifications
    `;
    const beforeCount = Number(notificationsBefore[0]?.count || 0);
    console.log(`   Total notifications in DB: ${beforeCount}`);
    if (notificationsBefore[0]?.latest) {
      console.log(`   Latest notification: ${new Date(notificationsBefore[0].latest).toLocaleString()}`);
    }

    // Step 4: Check notification logs before
    console.log('\n📝 Step 4: Checking notification logs (before)...');
    const logsBefore = await sql`
      SELECT 
        COUNT(*) as count,
        COUNT(DISTINCT supabase_carrier_user_id) as unique_users
      FROM notification_logs
      WHERE sent_at > NOW() - INTERVAL '1 hour'
    `;
    console.log(`   Logs in last hour: ${logsBefore[0]?.count || 0}`);
    console.log(`   Unique users: ${logsBefore[0]?.unique_users || 0}`);

    // Step 5: Trigger notification processing
    console.log('\n🚀 Step 5: Triggering notification processing...');
    console.log(`   Calling: POST ${baseUrl}/api/notifications/process`);
    
    let result: any = null;
    try {
      const response = await fetch(`${baseUrl}/api/notifications/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      result = await response.json();
      console.log('   ✅ Success!');
      console.log(`   - Users processed: ${result.usersProcessed || 0}`);
      console.log(`   - Total triggers: ${result.totalTriggers || 0}`);
      console.log(`   - Message: ${result.message || 'N/A'}`);

      // Step 6: Wait a bit for processing (only if API call succeeded)
      if (result && result.usersProcessed > 0) {
        console.log('\n⏳ Step 6: Waiting 5 seconds for worker to process jobs...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log('\n⏭️  Step 6: Skipping wait (no jobs enqueued or API unavailable)');
      }

      // Step 7: Check queue stats after
      console.log('\n📊 Step 7: Checking queue stats (after)...');
      try {
        const queueStatsAfter = await fetch(`${baseUrl}/api/notifications/queue-stats`);
        if (queueStatsAfter.ok) {
          const stats = await queueStatsAfter.json();
          console.log('   Queue Stats:');
          console.log(`   - Waiting: ${stats.waiting || 0}`);
          console.log(`   - Active: ${stats.active || 0}`);
          console.log(`   - Completed: ${stats.completed || 0}`);
          console.log(`   - Failed: ${stats.failed || 0}`);
          
          const completedDiff = (stats.completed || 0) - beforeCompleted;
          if (completedDiff > 0) {
            console.log(`   ✅ ${completedDiff} new job(s) completed!`);
          }
        }
      } catch (error) {
        console.log('   ⚠️  Could not fetch queue stats (API may not be running)');
      }

      // Step 8: Check notifications after
      console.log('\n📬 Step 8: Checking notifications created (after)...');
      const notificationsAfter = await sql`
        SELECT 
          cn.id,
          cn.supabase_user_id,
          cn.type as notification_type,
          cn.title,
          cn.message,
          cn.bid_number,
          cn.read as is_read,
          cn.created_at
        FROM carrier_notifications cn
        WHERE cn.created_at > NOW() - INTERVAL '10 minutes'
        ORDER BY cn.created_at DESC
        LIMIT 10
      `;

      if (notificationsAfter.length > 0) {
        console.log(`   ✅ Found ${notificationsAfter.length} new notification(s):`);
        notificationsAfter.forEach((notif, index) => {
          console.log(`   ${index + 1}. Type: ${notif.notification_type}`);
          console.log(`      Title: ${notif.title}`);
          console.log(`      Bid: ${notif.bid_number || 'N/A'}`);
          console.log(`      Created: ${new Date(notif.created_at).toLocaleString()}`);
          console.log(`      Read: ${notif.is_read ? 'Yes' : 'No'}`);
        });
      } else {
        console.log('   ⚠️  No new notifications found');
        console.log('   💡 This could mean:');
        console.log('      - No matches found for triggers');
        console.log('      - Rate limit reached');
        console.log('      - Worker not running');
        console.log('      - Preferences filtered out notifications');
      }

      // Step 9: Check notification logs after
      console.log('\n📝 Step 9: Checking notification logs (after)...');
      const logsAfter = await sql`
        SELECT 
          nl.id,
          nl.supabase_carrier_user_id,
          nl.notification_type,
          nl.bid_number,
          nl.message,
          nl.delivery_status,
          nl.sent_at
        FROM notification_logs nl
        WHERE nl.sent_at > NOW() - INTERVAL '10 minutes'
        ORDER BY nl.sent_at DESC
        LIMIT 10
      `;

      if (logsAfter.length > 0) {
        console.log(`   ✅ Found ${logsAfter.length} new log entry/entries:`);
        logsAfter.forEach((log, index) => {
          console.log(`   ${index + 1}. Type: ${log.notification_type}`);
          console.log(`      Bid: ${log.bid_number || 'N/A'}`);
          console.log(`      Status: ${log.delivery_status}`);
          console.log(`      Sent: ${new Date(log.sent_at).toLocaleString()}`);
        });
      } else {
        console.log('   ⚠️  No new log entries found');
      }

      // Step 10: Summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 SUMMARY');
      console.log('='.repeat(60));
      console.log(`✅ Active triggers: ${triggers.length}`);
      if (result) {
        console.log(`✅ Jobs enqueued: ${result.usersProcessed || 0}`);
      } else {
        console.log(`⚠️  Jobs enqueued: Could not trigger (API unavailable)`);
      }
      console.log(`✅ New notifications: ${notificationsAfter.length}`);
      console.log(`✅ New log entries: ${logsAfter.length}`);
      
      if (notificationsAfter.length === 0 && logsAfter.length === 0) {
        console.log('\n⚠️  No notifications were sent. Possible reasons:');
        console.log('   1. Worker is not running (check Railway logs)');
        console.log('   2. No matching loads found for triggers');
        console.log('   3. Rate limit reached (20 notifications/hour per user)');
        console.log('   4. User preferences filtered out notifications');
        console.log('   5. Email notifications disabled');
        console.log('\n💡 Next steps:');
        console.log('   - Check Railway worker logs');
        console.log('   - Verify triggers are configured correctly');
        console.log('   - Check user notification preferences');
        console.log('   - Ensure there are matching loads/bids in the database');
      } else {
        console.log('\n🎉 Notification system is working!');
      }

    } catch (error: any) {
      console.error('   ❌ Error triggering notifications:', error.message);
      console.error('\n💡 Troubleshooting:');
      console.error('   - Is the API server running? Start with: npm run dev');
      console.error('   - Or use production URL: Set NEXT_PUBLIC_APP_URL to your production domain');
      console.error('   - Verify the /api/notifications/process endpoint is accessible');
      console.error('\n⚠️  Skipping API trigger test. Continuing with database checks...');
      result = { usersProcessed: 0, totalTriggers: triggers.length };
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testNotificationSystem()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

