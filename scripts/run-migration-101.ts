#!/usr/bin/env tsx
/**
 * Run Migration 101: Add Favorites Notification Types
 * 
 * This script runs the migration to add favorites notification types to the notifications table constraint
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import sql from '../lib/db';

async function runMigration() {
  console.log('🚀 Starting Migration 101: Add Favorites Notification Types...\n');

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'db/migrations/101_add_favorites_notification_types.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Migration file loaded');
    console.log('🔧 Running migration...\n');

    // Execute the migration SQL
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration SQL executed successfully\n');

    // Verify the constraint was updated
    console.log('🔍 Verifying constraint...');
    const constraint = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conname = 'notifications_type_check'
      AND conrelid = 'notifications'::regclass;
    `;

    if (constraint.length > 0) {
      console.log('\n✅ Constraint updated successfully:');
      console.log(`   Name: ${constraint[0].constraint_name}`);
      console.log(`   Definition: ${constraint[0].constraint_definition.substring(0, 200)}...`);
      
      // Check if the new types are included
      const definition = constraint[0].constraint_definition;
      const requiredTypes = ['exact_match', 'state_match', 'state_pref_bid', 'similar_load', 'favorite_available'];
      const missingTypes = requiredTypes.filter(type => !definition.includes(type));
      
      if (missingTypes.length === 0) {
        console.log('\n✅ All favorites notification types are included in the constraint!');
        console.log('   Types added: exact_match, state_match, state_pref_bid, similar_load, favorite_available');
      } else {
        console.log('\n⚠️  Warning: Some types may be missing:', missingTypes);
      }
    } else {
      console.log('\n⚠️  Warning: Constraint not found. Migration may have failed.');
    }

    console.log('\n✅ Migration 101 completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the migration
runMigration();

