/**
 * Run migration 105: Add shop status setting
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Load .env.local first, then fall back to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local or .env');
  process.exit(1);
}

import sql from '../lib/db';

async function main() {
  try {
    console.log('🔄 Running migration 105: Add shop status setting...\n');
    
    const migration = readFileSync('./db/migrations/105_add_shop_status_setting.sql', 'utf-8');
    await sql.unsafe(migration);
    
    console.log('✅ Migration 105 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

main();

