/**
 * Script to run migration 104: Fix find_similar_loads function
 * This updates the function to use supabase_carrier_user_id instead of carrier_user_id
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('🔄 Running migration 104: Fix find_similar_loads function...');
    
    const migrationPath = join(process.cwd(), 'db/migrations/104_fix_find_similar_loads_supabase_user_id.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing migration SQL...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration 104 completed successfully!');
    console.log('✅ The find_similar_loads function now uses supabase_carrier_user_id');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    process.exit(1);
  }
}

runMigration();

