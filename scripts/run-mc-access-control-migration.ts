#!/usr/bin/env tsx
/**
 * Run MC Access Control Migration
 *
 * This script runs the migration for the MC Access Control system:
 * - 113: Create MC Access Control Table
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration(migrationNumber: number, description: string) {
  console.log(`\n🚀 Running Migration ${migrationNumber}: ${description}...\n`);

  try {
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

    await sql.unsafe(migrationSQL);
    console.log(`✅ Migration ${migrationNumber} completed successfully!`);

    return true;
  } catch (error: any) {
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
  console.log('🎯 Starting MC Access Control Migration...\n');

  await runMigration(113, 'Create MC Access Control Table');

  console.log('\n✅ MC Access Control migration completed successfully!\n');

  // Verify table
  console.log('🔍 Verifying table...\n');
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'mc_access_control'
    ORDER BY table_name;
  `;

  if (tables.length > 0) {
    console.log('📋 Created table:');
    tables.forEach((table: any) => {
      console.log(`   ✅ ${table.table_name}`);
    });
  } else {
    console.log('⚠️  Table not found - migration may have failed');
  }

  await sql.end();
}

runAllMigrations().catch(console.error);

