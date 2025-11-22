#!/usr/bin/env tsx
/**
 * Run Announcements System Migration (114)
 * 
 * This script runs the migration for the announcements system:
 * - Creates announcements table
 * - Creates announcement_reads table
 * - Updates notifications table to include 'announcement' type
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  console.log('\n🚀 Running Migration 114: Create Announcements System...\n');

  try {
    const migrationsDir = join(process.cwd(), 'db/migrations');
    const migrationFile = '114_create_announcements_system.sql';
    const fullPath = join(migrationsDir, migrationFile);
    
    if (!require('fs').existsSync(fullPath)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = readFileSync(fullPath, 'utf-8');

    console.log(`📝 Migration file: ${migrationFile}`);
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 114 completed successfully!');
    console.log('\n📋 Created:');
    console.log('   - announcements table');
    console.log('   - announcement_reads table');
    console.log('   - Updated notifications table with announcement type');
    console.log('   - Indexes for performance\n');

    return true;
  } catch (error: any) {
    // Check if it's a "already exists" error (safe to ignore for CREATE IF NOT EXISTS)
    if (error.message?.includes('already exists') || 
        error.message?.includes('duplicate') ||
        error.message?.includes('relation already exists')) {
      console.log('⚠️  Some objects already exist, but continuing...');
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

