#!/usr/bin/env node
/**
 * Clear All Loads Script
 * 
 * Usage: npx tsx scripts/clear-all-loads.ts
 * 
 * This script deletes all loads from the loads table.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import sql from '../lib/db';

async function clearAllLoads() {
  try {
    console.log('🗑️  Starting to clear all loads...');

    // First, count how many loads exist
    const countResult = await sql`
      SELECT COUNT(*) as count FROM loads
    `;
    const count = parseInt(countResult[0]?.count || '0');
    
    console.log(`📊 Found ${count} loads to delete`);

    if (count === 0) {
      console.log('✅ No loads to delete. Database is already empty.');
      process.exit(0);
    }

    // Delete all loads
    const result = await sql`
      DELETE FROM loads
    `;

    console.log(`✅ Successfully deleted ${count} loads`);
    console.log('✨ Database cleared!');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error clearing loads:', error);
    process.exit(1);
  }
}

clearAllLoads();

