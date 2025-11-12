/**
 * Test Redis Connection Script
 * 
 * Run this to verify your Redis connection is working:
 *   tsx scripts/test-redis-connection.ts
 */

import 'dotenv/config';
import { redisConnection } from '../lib/notification-queue';

async function testConnection() {
  try {
    console.log('Testing Redis connection...');
    
    // Test basic connection
    const result = await redisConnection.ping();
    console.log('✅ Redis ping successful:', result);
    
    // Test set/get
    await redisConnection.set('test:connection', 'success', 'EX', 10);
    const value = await redisConnection.get('test:connection');
    console.log('✅ Redis set/get successful:', value);
    
    // Test queue operations
    const { notificationQueue } = await import('../lib/notification-queue');
    const stats = await notificationQueue.getWaitingCount();
    console.log('✅ Queue connection successful. Waiting jobs:', stats);
    
    console.log('\n🎉 Redis connection is working correctly!');
    console.log('You can now start the notification worker with:');
    console.log('  npm run worker:notifications');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check REDIS_URL is set in .env.local');
    console.error('2. Verify password is correct');
    console.error('3. Ensure using rediss:// (with double s) for TLS');
    console.error('4. Check Upstash dashboard for correct endpoint');
    process.exit(1);
  }
}

testConnection();

