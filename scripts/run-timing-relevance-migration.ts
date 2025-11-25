#!/usr/bin/env tsx
/**
 * Run Migration 103: Add use_timing_relevance column
 * 
 * This script runs the migration to add the use_timing_relevance column
 * to carrier_notification_preferences table.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  console.log('\n🚀 Running Migration 103: Add use_timing_relevance column...\n');

  try {
    const migrationFile = join(process.cwd(), 'db/migrations/103_add_use_timing_relevance.sql');
    const migrationSQL = readFileSync(migrationFile, 'utf-8');

    console.log('📝 Migration file: 103_add_use_timing_relevance.sql');
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 103 completed successfully!');

    // Verify the column was added
    const columnCheck = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'carrier_notification_preferences' 
        AND column_name = 'use_timing_relevance'
      ) as column_exists
    `;
    
    if (columnCheck[0]?.column_exists) {
      console.log('✅ Verified: use_timing_relevance column exists');
    } else {
      console.log('⚠️  Warning: Column check returned false, but migration completed');
    }

    return true;
  } catch (error: any) {
    // Check if it's a "already exists" error (safe to ignore for ADD COLUMN IF NOT EXISTS)
    if (error.message?.includes('already exists') || 
        error.message?.includes('duplicate') ||
        error.message?.includes('column already exists')) {
      console.log('⚠️  Column already exists, but continuing...');
      return true;
    }
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await runMigration();
    console.log('\n✅ All migrations completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

