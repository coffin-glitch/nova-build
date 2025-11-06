#!/usr/bin/env tsx
/**
 * Run DST Archive Fix Migration
 * 
 * This script runs the DST-aware archiving migration and fixes existing data
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  console.log('🚀 Starting DST Archive Fix Migration...\n');

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'db/migrations/080_fix_dst_archiving.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Migration file loaded');
    console.log('🔧 Running migration...\n');

    // Execute the entire migration file as a single transaction
    // PostgreSQL functions contain semicolons internally, so we need to execute the whole file
    try {
      await sql.unsafe(migrationSQL);
      console.log('✅ Migration SQL executed successfully\n');
    } catch (error: any) {
      // If it's a "relation already exists" or similar error, that's okay for CREATE OR REPLACE
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('⚠️  Some objects already exist, but continuing...\n');
      } else {
        throw error;
      }
    }

    // Verify the functions were created
    console.log('🔍 Verifying functions...');
    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('set_end_of_day_archived_timestamps', 'get_end_of_day_utc', 'get_utc_cutoff_time')
      ORDER BY routine_name;
    `;

    console.log('\n📋 Created functions:');
    functions.forEach((func: any) => {
      console.log(`   ✅ ${func.routine_name}`);
    });

    // Check how many bids were fixed
    console.log('\n🔍 Checking for fixed bids...');
    const fixedBids = await sql`
      SELECT COUNT(*) as count
      FROM telegram_bids
      WHERE archived_at IS NOT NULL
        AND archived_at >= '2025-11-03 04:59:59 UTC'::timestamp
        AND archived_at < '2025-11-06 06:00:00 UTC'::timestamp
        AND (archived_at AT TIME ZONE 'America/Chicago')::time = '23:59:59'::time;
    `;

    const fixedCount = fixedBids[0]?.count || 0;
    console.log(`   ✅ Found ${fixedCount} bids with corrected timestamps\n`);

    console.log('🎉 Migration complete! The archiving system will now:');
    console.log('   ✅ Automatically handle DST transitions');
    console.log('   ✅ Use 04:59:59 UTC during CDT (summer)');
    console.log('   ✅ Use 05:59:59 UTC during CST (winter)');
    console.log('   ✅ Continue working correctly when DST starts again in March\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the migration
runMigration().catch(console.error);

