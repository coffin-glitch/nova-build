/**
 * Comprehensive Upstash Notification System Test
 * 
 * This script tests:
 * 1. REDIS_URL environment variable
 * 2. Redis connection
 * 3. Queue operations
 * 4. Worker readiness
 * 
 * Run: tsx scripts/test-upstash-notification.ts
 */

import 'dotenv/config';
import { redisConnection, notificationQueue, urgentNotificationQueue, getQueueStats } from '../lib/notification-queue';

async function testUpstashConnection() {
  console.log('🔍 Testing Upstash Notification System\n');
  
  // Step 1: Check environment variable
  console.log('Step 1: Checking REDIS_URL...');
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL is not set in .env.local');
    console.error('\n📝 To fix this:');
    console.error('1. Go to your Upstash dashboard: https://console.upstash.com/');
    console.error('2. Find your Redis database (NOVA)');
    console.error('3. Copy the connection string');
    console.error('4. Add to .env.local:');
    console.error('   REDIS_URL=rediss://default:YOUR_PASSWORD@active-penguin-36152.upstash.io:6379');
    console.error('\n⚠️  Important: Use rediss:// (with double s) for TLS');
    process.exit(1);
  }
  
  if (!redisUrl.includes('upstash')) {
    console.warn('⚠️  REDIS_URL does not appear to be an Upstash URL');
    console.warn('   Current URL:', redisUrl.replace(/:[^:@]+@/, ':****@'));
  } else {
    console.log('✅ REDIS_URL is set');
    console.log('   URL:', redisUrl.replace(/:[^:@]+@/, ':****@'));
  }
  
  // Step 2: Test Redis connection
  console.log('\nStep 2: Testing Redis connection...');
  try {
    const pingResult = await redisConnection.ping();
    console.log('✅ Redis ping successful:', pingResult);
  } catch (error: any) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check your REDIS_URL is correct');
    console.error('2. Verify password is correct (reset in Upstash if needed)');
    console.error('3. Ensure using rediss:// (with double s) for TLS');
    console.error('4. Check Upstash dashboard for correct endpoint');
    process.exit(1);
  }
  
  // Step 3: Test basic operations
  console.log('\nStep 3: Testing Redis operations...');
  try {
    await redisConnection.set('test:notification:system', 'working', 'EX', 10);
    const value = await redisConnection.get('test:notification:system');
    console.log('✅ Set/Get operations working:', value);
  } catch (error: any) {
    console.error('❌ Redis operations failed:', error.message);
    process.exit(1);
  }
  
  // Step 4: Test queue operations
  console.log('\nStep 4: Testing queue operations...');
  try {
    const stats = await getQueueStats();
    console.log('✅ Queue stats retrieved:');
    console.log('   Waiting:', stats.waiting);
    console.log('   Active:', stats.active);
    console.log('   Completed:', stats.completed);
    console.log('   Failed:', stats.failed);
    console.log('   Total:', stats.total);
  } catch (error: any) {
    console.error('❌ Queue operations failed:', error.message);
    process.exit(1);
  }
  
  // Step 5: Test adding a job
  console.log('\nStep 5: Testing job enqueueing...');
  try {
    const testJob = await notificationQueue.add('test-job', {
      userId: 'test-user',
      triggers: [],
    }, {
      jobId: `test-${Date.now()}`,
    });
    console.log('✅ Job enqueued successfully:', testJob.id);
    
    // Clean up test job
    await testJob.remove();
    console.log('✅ Test job cleaned up');
  } catch (error: any) {
    console.error('❌ Job enqueueing failed:', error.message);
    process.exit(1);
  }
  
  // Final summary
  console.log('\n🎉 All tests passed!');
  console.log('\n📋 Next steps:');
  console.log('1. Start the notification worker:');
  console.log('   npm run worker:notifications');
  console.log('\n2. Test the queue stats endpoint:');
  console.log('   curl http://localhost:3000/api/notifications/queue-stats');
  console.log('\n3. Trigger notification processing:');
  console.log('   curl -X POST http://localhost:3000/api/notifications/process');
  console.log('\n4. Monitor queue stats in browser:');
  console.log('   http://localhost:3000/api/notifications/queue-stats');
  
  process.exit(0);
}

testUpstashConnection().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

