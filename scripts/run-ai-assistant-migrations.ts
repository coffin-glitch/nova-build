#!/usr/bin/env tsx
/**
 * Run AI Assistant Migrations (111 and 112)
 * 
 * This script runs the migrations for the AI assistant feature:
 * - 111: Create AI assistant conversations and messages tables
 * - 112: Add vector embeddings and advanced memory system
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration(migrationNumber: number, description: string) {
  console.log(`\n🚀 Running Migration ${migrationNumber}: ${description}...\n`);

  try {
    // Find the migration file
    const migrationsDir = join(process.cwd(), 'db/migrations');
    const files = require('fs').readdirSync(migrationsDir)
      .filter((f: string) => f.startsWith(String(migrationNumber).padStart(3, '0')));
    
    if (files.length === 0) {
      throw new Error(`Migration file not found for ${migrationNumber}`);
    }
    
    const migrationFile = files[0];
    const fullPath = join(migrationsDir, migrationFile);
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
  console.log('🎯 Starting AI Assistant Migrations...\n');

  try {
    // Run migration 111
    await runMigration(111, 'Create AI Assistant Conversations and Messages Tables');
    
    // Run migration 112
    await runMigration(112, 'Add Vector Embeddings and Advanced Memory System');

    console.log('\n✅ All AI Assistant migrations completed successfully!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'ai_assistant_conversations',
          'ai_assistant_messages',
          'ai_memory_chunks',
          'ai_knowledge_base'
        )
      ORDER BY table_name;
    `;

    console.log('\n📋 Created tables:');
    tables.forEach((table: any) => {
      console.log(`   ✅ ${table.table_name}`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run migrations
runAllMigrations();

