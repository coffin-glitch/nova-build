#!/usr/bin/env tsx
/**
 * Run Notification Tier Migration (104)
 * 
 * This script runs the migration to add notification_tier column to carrier_profiles:
 * - Adds notification_tier column with default 'new'
 * - Adds CHECK constraint for valid tiers (premium, standard, new)
 * - Creates index for tier lookups
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  console.log('\n🚀 Running Migration 104: Add Notification Tier Column...\n');

  try {
    const migrationsDir = join(process.cwd(), 'db/migrations');
    const migrationFile = '104_add_notification_tier.sql';
    const fullPath = join(migrationsDir, migrationFile);
    
    if (!require('fs').existsSync(fullPath)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = readFileSync(fullPath, 'utf-8');

    console.log(`📝 Migration file: ${migrationFile}`);
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 104 completed successfully!');
    console.log('\n📋 Added:');
    console.log('   - notification_tier column to carrier_profiles');
    console.log('   - CHECK constraint for valid tiers (premium, standard, new)');
    console.log('   - Index for tier lookups');
    console.log('   - Default value: new\n');

    return true;
  } catch (error: any) {
    // Check if it's a "already exists" error (safe to ignore for IF NOT EXISTS)
    if (error.message?.includes('already exists') || 
        error.message?.includes('duplicate') ||
        error.message?.includes('relation already exists') ||
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
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to run migration:', error);
    process.exit(1);
  }
}

main();

