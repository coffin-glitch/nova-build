/**
 * Check Worker Status Script
 * 
 * Run this to verify the worker is running and processing jobs:
 *   tsx scripts/check-worker-status.ts
 */

import 'dotenv/config';
import { getQueueStats } from '../lib/notification-queue';

async function checkStatus() {
  try {
    console.log('🔍 Checking notification worker status...\n');
    
    const stats = await getQueueStats();
    
    console.log('📊 Queue Statistics:');
    console.log(`   Waiting jobs: ${stats.waiting}`);
    console.log(`   Active jobs: ${stats.active}`);
    console.log(`   Completed jobs: ${stats.completed}`);
    console.log(`   Failed jobs: ${stats.failed}`);
    console.log(`   Delayed jobs: ${stats.delayed}`);
    console.log(`   Total jobs: ${stats.total}\n`);
    
    if (stats.waiting > 0 || stats.active > 0) {
      console.log('✅ Worker is processing jobs!');
    } else if (stats.completed > 0) {
      console.log('✅ Worker has processed jobs successfully!');
    } else {
      console.log('ℹ️  No jobs in queue. Worker is ready and waiting.');
      console.log('   Trigger processing with: POST /api/notifications/process');
    }
    
    console.log('\n💡 To see worker logs, check the terminal where you ran:');
    console.log('   npm run worker:notifications');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking worker status:', error);
    console.error('\nMake sure:');
    console.error('1. Worker is running: npm run worker:notifications');
    console.error('2. REDIS_URL is set correctly');
    process.exit(1);
  }
}

checkStatus();

