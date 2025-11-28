/**
 * Script to check notification processing status
 * Verifies test bids exist and checks if notifications were created
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

async function main() {
  try {
    console.log('🔍 Checking notification system status...\n');
    
    // 1. Check if test bids exist
    console.log('1️⃣ Checking test bids...');
    const testBids = await sql`
      SELECT bid_number, stops, distance_miles, received_at, is_archived
      FROM telegram_bids
      WHERE bid_number IN ('999990001', '999990002', '999990003')
      ORDER BY bid_number
    `;
    
    if (testBids.length === 0) {
      console.log('   ❌ No test bids found in database');
      process.exit(1);
    }
    
    console.log(`   ✅ Found ${testBids.length} test bid(s):`);
    testBids.forEach((bid: any) => {
      const stops = Array.isArray(bid.stops) ? bid.stops : JSON.parse(bid.stops || '[]');
      const route = stops.length >= 2 
        ? `${stops[0]} → ${stops[stops.length - 1]}`
        : 'Unknown route';
      console.log(`      - #${bid.bid_number}: ${route} (archived: ${bid.is_archived})`);
    });
    
    // 2. Check for user with email dukeisaac12@gmail.com
    console.log('\n2️⃣ Checking user for dukeisaac12@gmail.com...');
    const user = await sql`
      SELECT id, email
      FROM auth.users
      WHERE email = 'dukeisaac12@gmail.com'
      LIMIT 1
    `;
    
    if (user.length === 0) {
      console.log('   ❌ User not found');
      process.exit(1);
    }
    
    const userId = user[0].id;
    console.log(`   ✅ Found user: ${user[0].email} (ID: ${userId})`);
    
    // 3. Check active notification triggers
    console.log('\n3️⃣ Checking active notification triggers...');
    const triggers = await sql`
      SELECT id, trigger_type, trigger_config, is_active
      FROM notification_triggers
      WHERE supabase_carrier_user_id = ${userId}
        AND is_active = true
      ORDER BY trigger_type
    `;
    
    if (triggers.length === 0) {
      console.log('   ⚠️  No active notification triggers found for this user');
      console.log('   💡 This is why notifications aren\'t being sent!');
    } else {
      console.log(`   ✅ Found ${triggers.length} active trigger(s):`);
      triggers.forEach((trigger: any) => {
        console.log(`      - ${trigger.trigger_type} (ID: ${trigger.id})`);
        if (trigger.trigger_config?.favoriteBidNumber) {
          console.log(`        Favorite Bid: ${trigger.trigger_config.favoriteBidNumber}`);
        }
        if (trigger.trigger_config?.statePreferences) {
          console.log(`        State Prefs: ${trigger.trigger_config.statePreferences.join(', ')}`);
        }
      });
    }
    
    // 4. Check notification logs
    console.log('\n4️⃣ Checking notification logs...');
    const notificationLogs = await sql`
      SELECT 
        nl.id,
        nl.bid_number,
        nl.notification_type,
        nl.sent_at,
        nl.delivery_status
      FROM notification_logs nl
      WHERE nl.supabase_carrier_user_id = ${userId}
        AND nl.bid_number IN ('999990001', '999990002', '999990003')
      ORDER BY nl.sent_at DESC
      LIMIT 10
    `;
    
    if (notificationLogs.length === 0) {
      console.log('   ⚠️  No notification logs found for test bids');
      console.log('   💡 Notifications have not been processed yet');
    } else {
      console.log(`   ✅ Found ${notificationLogs.length} notification log(s):`);
      notificationLogs.forEach((log: any) => {
        console.log(`      - #${log.bid_number}: ${log.notification_type} (sent: ${log.sent_at})`);
        console.log(`        Status: ${log.delivery_status || 'unknown'}`);
      });
    }
    
    // 5. Check notifications (check notifications table)
    console.log('\n5️⃣ Checking notifications...');
    // First check recent notifications (last 10 minutes)
    const recentNotifications = await sql`
      SELECT 
        n.id,
        n.type,
        n.title,
        n.message,
        n.created_at,
        n.read,
        n.data
      FROM notifications n
      WHERE n.user_id = ${userId}
        AND n.created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    
    // Filter for test bids
    const carrierNotifications = recentNotifications.filter((notif: any) => {
      const bidNumber = notif.data?.bid_number;
      return bidNumber && ['999990001', '999990002', '999990003'].includes(String(bidNumber));
    });
    
    if (carrierNotifications.length === 0) {
      console.log('   ⚠️  No carrier notifications found for test bids');
    } else {
      console.log(`   ✅ Found ${carrierNotifications.length} notification(s):`);
      carrierNotifications.forEach((notif: any) => {
        const bidNumber = notif.data?.bid_number || 'N/A';
        console.log(`      - #${bidNumber}: ${notif.type}`);
        console.log(`        ${notif.title || notif.message}`);
        console.log(`        Created: ${notif.created_at}, Read: ${notif.read ? 'Yes' : 'No'}`);
      });
    }
    
    // 6. Summary
    console.log('\n📊 Summary:');
    console.log(`   Test Bids: ${testBids.length}/3`);
    console.log(`   Active Triggers: ${triggers.length}`);
    console.log(`   Notification Logs: ${notificationLogs.length}`);
    console.log(`   Carrier Notifications: ${carrierNotifications.length}`);
    
    if (triggers.length === 0) {
      console.log('\n⚠️  ISSUE: No active notification triggers found!');
      console.log('   The user needs to set up notification triggers in the UI.');
    } else if (notificationLogs.length === 0 && carrierNotifications.length === 0) {
      console.log('\n⚠️  ISSUE: Notifications have not been processed yet.');
      console.log('   The notification worker may not have run yet.');
      console.log('   Wait for the cron job (every 2 minutes) or manually trigger processing.');
    } else {
      console.log('\n✅ Notifications appear to be working!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking notification status:', error);
    process.exit(1);
  }
}

main();

