/**
 * Script to check if migration 104 has been run and run it if needed
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local explicitly
config({ path: '.env.local' });

import sql from '../lib/db';

async function checkAndRunMigration() {
  try {
    console.log('🔍 Checking if migration 104 has been run...');
    
    // Check the current function definition
    const functionCheck = await sql`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'find_similar_loads'
      LIMIT 1
    `;
    
    if (functionCheck.length === 0) {
      console.log('⚠️  Function find_similar_loads does not exist. Running migration...');
      await runMigration();
      return;
    }
    
    const definition = functionCheck[0].definition;
    
    // Check if it uses the old carrier_user_id or new supabase_carrier_user_id
    if (definition.includes('carrier_user_id = p_carrier_user_id') && 
        !definition.includes('supabase_carrier_user_id = p_carrier_user_id')) {
      console.log('❌ Migration 104 has NOT been run yet.');
      console.log('   Function still uses carrier_user_id instead of supabase_carrier_user_id');
      console.log('🔄 Running migration now...');
      await runMigration();
    } else if (definition.includes('supabase_carrier_user_id = p_carrier_user_id')) {
      console.log('✅ Migration 104 has already been run!');
      console.log('   Function already uses supabase_carrier_user_id');
    } else {
      console.log('⚠️  Could not determine migration status. Running migration to be safe...');
      await runMigration();
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    process.exit(1);
  }
}

async function runMigration() {
  const migrationPath = join(process.cwd(), 'db/migrations/104_fix_find_similar_loads_supabase_user_id.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  console.log('📝 Executing migration SQL...');
  await sql.unsafe(migrationSQL);
  
  console.log('✅ Migration 104 completed successfully!');
  console.log('✅ The find_similar_loads function now uses supabase_carrier_user_id');
}

checkAndRunMigration();

