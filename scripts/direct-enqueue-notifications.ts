/**
 * Script to directly enqueue notification jobs in Redis
 * Bypasses the webhook and directly enqueues jobs for the notification worker
 */

// Load environment variables BEFORE importing
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
import { notificationQueue, urgentNotificationQueue } from '../lib/notification-queue';

async function main() {
  try {
    console.log('🔔 Directly enqueueing notification jobs...\n');
    
    // Get user ID for dukeisaac12@gmail.com
    const user = await sql`
      SELECT id, email
      FROM auth.users
      WHERE email = 'dukeisaac12@gmail.com'
      LIMIT 1
    `;
    
    if (user.length === 0) {
      console.error('❌ User not found');
      process.exit(1);
    }
    
    const userId = user[0].id;
    console.log(`✅ Found user: ${user[0].email} (ID: ${userId})\n`);
    
    // Get all active triggers for this user
    const triggers = await sql`
      SELECT 
        nt.id,
        nt.trigger_type,
        nt.trigger_config,
        nt.is_active
      FROM notification_triggers nt
      WHERE nt.supabase_carrier_user_id = ${userId}
        AND nt.is_active = true
      ORDER BY nt.trigger_type
    `;
    
    if (triggers.length === 0) {
      console.log('⚠️  No active triggers found for this user');
      process.exit(1);
    }
    
    console.log(`✅ Found ${triggers.length} active trigger(s):`);
    triggers.forEach((trigger: any) => {
      console.log(`   - ${trigger.trigger_type} (ID: ${trigger.id})`);
    });
    
    // Determine priority based on trigger types
    const hasUrgent = triggers.some((t: any) => 
      t.trigger_type === 'exact_match' || 
      t.trigger_type === 'deadline_approaching'
    );
    
    const queue = hasUrgent ? urgentNotificationQueue : notificationQueue;
    const queueName = hasUrgent ? 'urgent' : 'normal';
    
    console.log(`\n📤 Enqueueing job in ${queueName} queue...`);
    
    const triggerData = triggers.map((t: any) => ({
      id: t.id,
      triggerType: t.trigger_type,
      triggerConfig: t.trigger_config,
    }));
    
    await queue.add(
      `process-user-${userId}`,
      {
        userId,
        triggers: triggerData,
      },
      {
        priority: hasUrgent ? 10 : 5,
        jobId: `user-${userId}-${Date.now()}`, // Unique job ID
      }
    );
    
    console.log('✅ Job enqueued successfully!');
    console.log(`   Job ID: user-${userId}-${Date.now()}`);
    console.log(`   Queue: ${queueName}`);
    console.log(`   Triggers: ${triggers.length}`);
    console.log('\n💡 The Railway worker should pick up this job and process notifications.');
    console.log('   Check Railway logs to see processing activity.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error enqueueing jobs:', error);
    process.exit(1);
  }
}

main();

