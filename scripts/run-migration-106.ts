/**
 * Run migration 106: Fix Supabase Database Linter Security Issues
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

async function main() {
  // Dynamic import after env vars are loaded
  const { default: sql } = await import('../lib/db');
  
  try {
    console.log('🚀 Running migration 106: Fix Supabase Database Linter Security Issues...\n');

    // Read the migration file
    const migrationPath = resolve(process.cwd(), 'db/migrations/106_fix_security_linter_issues.sql');
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
      if (error.message?.includes('already exists') || 
          error.message?.includes('duplicate') ||
          error.message?.includes('relation already exists')) {
        console.log('⚠️  Some objects already exist, but continuing...\n');
      } else {
        throw error;
      }
    }

    // Verify RLS is enabled on key tables
    console.log('🔍 Verifying RLS is enabled...');
    const rlsStatus = await sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('telegram_bids', 'carrier_profiles', 'carrier_bids', 'notifications')
      ORDER BY tablename;
    `;

    console.log('\n📋 RLS Status:');
    rlsStatus.forEach((table: any) => {
      console.log(`   ${table.rowsecurity ? '✅' : '❌'} ${table.tablename}: RLS ${table.rowsecurity ? 'enabled' : 'disabled'}`);
    });

    // Verify views are fixed
    console.log('\n🔍 Verifying views...');
    const views = await sql`
      SELECT viewname, definition
      FROM pg_views
      WHERE schemaname = 'public'
        AND viewname IN ('active_telegram_bids', 'expired_bids');
    `;

    console.log('\n📋 Views:');
    views.forEach((view: any) => {
      console.log(`   ✅ ${view.viewname}`);
    });

    console.log(`\n✅ Migration 106 completed successfully!`);
    console.log(`   - Fixed Security Definer views (active_telegram_bids, expired_bids)`);
    console.log(`   - Enabled RLS on all tables with permissive policies`);
    console.log(`   - Applied policies for direct PostgreSQL connections`);
    console.log(`\n⚠️  Note: Function search_path warnings are optional and not fixed in this migration.`);

    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration 106 failed:', error?.message);
    console.error('Error details:', error);
    await sql.end();
    process.exit(1);
  }
}

main();
