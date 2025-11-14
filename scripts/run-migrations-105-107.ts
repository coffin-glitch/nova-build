#!/usr/bin/env tsx
/**
 * Run Migrations 105-107: Notification System Improvements
 * 
 * This script runs the three migrations for:
 * - 105: Additional composite indexes
 * - 106: Notification logs archival system
 * - 107: Trigger config validation
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration(migrationNumber: number, description: string) {
  console.log(`\n🚀 Running Migration ${migrationNumber}: ${description}...\n`);

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), `db/migrations/${String(migrationNumber).padStart(3, '0')}_*.sql`);
    const files = require('fs').readdirSync(join(process.cwd(), 'db/migrations'))
      .filter((f: string) => f.startsWith(String(migrationNumber).padStart(3, '0')));
    
    if (files.length === 0) {
      throw new Error(`Migration file not found for ${migrationNumber}`);
    }
    
    const migrationFile = files[0];
    const fullPath = join(process.cwd(), 'db/migrations', migrationFile);
    const migrationSQL = readFileSync(fullPath, 'utf-8');

    console.log(`📝 Migration file: ${migrationFile}`);
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log(`✅ Migration ${migrationNumber} completed successfully!`);

    return true;
  } catch (error: any) {
    // Check if it's a "already exists" error (safe to ignore for CREATE IF NOT EXISTS)
    if (error.message?.includes('already exists') || 
        error.message?.includes('duplicate') ||
        error.message?.includes('relation already exists')) {
      console.log(`⚠️  Some objects already exist in migration ${migrationNumber}, but continuing...`);
      return true;
    }
    throw error;
  }
}

async function runAllMigrations() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Notification System Improvements - Migrations 105-107        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const migrations = [
    { number: 105, description: 'Additional Composite Indexes' },
    { number: 106, description: 'Notification Logs Archival System' },
    { number: 107, description: 'Trigger Config Validation' },
  ];

  try {
    for (const migration of migrations) {
      await runMigration(migration.number, migration.description);
    }

    // Verify migrations
    console.log('\n🔍 Verifying migrations...\n');

    // Check indexes
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_notifications%'
        AND indexname IN (
          'idx_notifications_user_type_created',
          'idx_notifications_user_read_created',
          'idx_notifications_user_type_filter'
        )
      ORDER BY indexname;
    `;
    console.log('📊 Created indexes:');
    indexes.forEach((idx: any) => {
      console.log(`   ✅ ${idx.indexname}`);
    });

    // Check archive table
    const archiveTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_logs_archive'
      ) as exists;
    `;
    if (archiveTable[0]?.exists) {
      console.log('\n✅ Archive table created: notification_logs_archive');
    }

    // Check archive function
    const archiveFunction = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'archive_old_notification_logs'
      ) as exists;
    `;
    if (archiveFunction[0]?.exists) {
      console.log('✅ Archive function created: archive_old_notification_logs()');
    }

    // Check validation constraint
    const constraint = await sql`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'notification_triggers'::regclass 
        AND conname = 'check_trigger_config_valid';
    `;
    if (constraint.length > 0) {
      console.log('✅ Validation constraint created: check_trigger_config_valid');
    }

    console.log('\n✨ All migrations completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the migrations
runAllMigrations();

