#!/usr/bin/env tsx
/**
 * Run Tier System Migrations (104 and 119)
 * 
 * This script runs both migrations for the tier system:
 * - 104: Add notification_tier column to carrier_profiles
 * - 119: Add notifications_disabled column to carrier_profiles
 */

// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration(migrationNumber: number, description: string) {
  console.log(`\n🚀 Running Migration ${migrationNumber}: ${description}...\n`);

  try {
    const migrationsDir = join(process.cwd(), 'db/migrations');
    const migrationFile = `${String(migrationNumber).padStart(3, '0')}_*.sql`;
    const files = require('fs').readdirSync(migrationsDir)
      .filter((f: string) => f.startsWith(String(migrationNumber).padStart(3, '0')));
    
    if (files.length === 0) {
      throw new Error(`Migration file not found for ${migrationNumber}`);
    }
    
    const migrationFileName = files[0];
    const fullPath = join(migrationsDir, migrationFileName);
    const migrationSQL = readFileSync(fullPath, 'utf-8');

    console.log(`📝 Migration file: ${migrationFileName}`);
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log(`✅ Migration ${migrationNumber} completed successfully!`);

    return true;
  } catch (error: any) {
    // Check if it's a "already exists" error (safe to ignore for IF NOT EXISTS)
    if (error.message?.includes('already exists') || 
        error.message?.includes('duplicate') ||
        error.message?.includes('relation already exists') ||
        error.message?.includes('column already exists')) {
      console.log(`⚠️  Some objects already exist in migration ${migrationNumber}, but continuing...`);
      return true;
    }
    console.error(`❌ Migration ${migrationNumber} failed:`, error);
    throw error;
  }
}

async function runAllMigrations() {
  console.log('🎯 Starting Tier System Migrations...\n');

  try {
    // Run migration 104: Add notification_tier column
    await runMigration(104, 'Add Notification Tier Column');
    console.log('\n📋 Migration 104 added:');
    console.log('   - notification_tier column to carrier_profiles');
    console.log('   - CHECK constraint for valid tiers (premium, standard, new)');
    console.log('   - Index for tier lookups');
    console.log('   - Default value: new');

    // Run migration 119: Add notifications_disabled column
    await runMigration(119, 'Add Notifications Disabled Column (Kill Switch)');
    console.log('\n📋 Migration 119 added:');
    console.log('   - notifications_disabled column to carrier_profiles');
    console.log('   - Index for quick lookups');
    console.log('   - Kill switch functionality');

    console.log('\n✅ All tier system migrations completed successfully!');
    console.log('\n🎉 The tier system is now fully operational!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to run migrations:', error);
    process.exit(1);
  }
}

runAllMigrations();

