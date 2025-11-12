/**
 * Verify Worker Connection Script
 * 
 * This script verifies the worker can connect to Redis
 */

import 'dotenv/config';
import { redisConnection } from '../lib/notification-queue';

async function verify() {
  try {
    console.log('🔍 Verifying Redis connection for worker...\n');
    
    // Check REDIS_URL is set
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.error('❌ REDIS_URL is not set in environment variables');
      console.error('   Make sure .env.local has REDIS_URL set');
      process.exit(1);
    }
    
    console.log('✅ REDIS_URL is set');
    console.log(`   URL: ${redisUrl.substring(0, 40)}...\n`);
    
    // Test connection
    console.log('Testing Redis connection...');
    const result = await redisConnection.ping();
    console.log(`✅ Redis ping successful: ${result}\n`);
    
    // Test queue
    const { notificationQueue } = await import('../lib/notification-queue');
    const stats = await notificationQueue.getWaitingCount();
    console.log(`✅ Queue accessible. Waiting jobs: ${stats}\n`);
    
    console.log('🎉 Worker should be able to connect successfully!');
    console.log('\nIf worker still shows connection errors:');
    console.log('1. Make sure .env.local exists and has REDIS_URL');
    console.log('2. Restart the worker: npm run worker:notifications');
    console.log('3. Check worker logs for detailed error messages');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nThis means it\'s trying to connect to localhost:6379');
      console.error('REDIS_URL is not being loaded. Check:');
      console.error('1. .env.local exists in project root');
      console.error('2. REDIS_URL is set correctly');
      console.error('3. Worker imports dotenv/config at the top');
    }
    process.exit(1);
  }
}

verify();

