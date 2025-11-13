/**
 * Check Redis Eviction Policy
 * 
 * This script checks the current Redis eviction policy
 * Run: tsx scripts/check-redis-eviction-policy.ts
 */

import 'dotenv/config';
import { redisConnection } from '../lib/notification-queue';

async function checkEvictionPolicy() {
  try {
    console.log('🔍 Checking Redis eviction policy...\n');
    
    // Wait for connection to be ready
    await redisConnection.ping();
    console.log('✅ Redis connection established\n');
    
    // Get memory info
    const info = await redisConnection.info('memory');
    
    // Extract eviction policy
    const policyMatch = info.match(/maxmemory-policy:(\w+)/);
    
    if (policyMatch) {
      const policy = policyMatch[1];
      console.log(`Current eviction policy: ${policy}`);
      
      if (policy === 'noeviction') {
        console.log('✅ Policy is set to "noeviction" (recommended for queues)');
      } else {
        console.log(`⚠️  Policy is "${policy}" (not recommended for queues)`);
        console.log('\nTo change it:');
        console.log('1. Go to https://console.upstash.com/');
        console.log('2. Select your Redis database');
        console.log('3. Go to Settings');
        console.log('4. Change "Eviction Policy" to "noeviction"');
        console.log('5. Save and restart the worker');
      }
    } else {
      console.log('⚠️  Could not find eviction policy in Redis info');
      console.log('\nMemory info snippet:');
      console.log(info.split('\n').slice(0, 10).join('\n'));
    }
    
    // Also check maxmemory
    const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
    if (maxMemoryMatch) {
      const maxMemory = parseInt(maxMemoryMatch[1]);
      if (maxMemory === 0) {
        console.log('\n✅ maxmemory is 0 (unlimited)');
      } else {
        const maxMemoryMB = (maxMemory / 1024 / 1024).toFixed(2);
        console.log(`\n📊 maxmemory: ${maxMemoryMB} MB`);
      }
    }
    
    await redisConnection.quit();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error checking eviction policy:', error.message);
    process.exit(1);
  }
}

checkEvictionPolicy();

