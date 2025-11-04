/**
 * Safe migration runner for removing clerk_user_id columns
 * This script provides a TypeScript/Node.js alternative to the bash script
 * 
 * Usage: npx tsx scripts/run-clerk-removal-safe.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Clerk User ID Removal Migration - Safe Execution            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check for database connection
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL or POSTGRES_URL not set');
    console.error('   Please set your database connection string');
    process.exit(1);
  }

  console.log('📋 Migration Plan:');
  console.log('   1. Verify database state');
  console.log('   2. Create backup (recommended manually)');
  console.log('   3. Run migration: db/migrations/078_remove_clerk_user_id_complete.sql');
  console.log('   4. Verify completion');
  console.log('');

  // Read migration file
  const migrationPath = join(process.cwd(), 'db/migrations/078_remove_clerk_user_id_complete.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  console.log('✅ Migration file loaded');
  console.log(`   File: ${migrationPath}`);
  console.log(`   Size: ${migrationSQL.length} bytes`);
  console.log('');

  console.log('⚠️  IMPORTANT NOTES:');
  console.log('   • This migration will permanently remove clerk_user_id columns');
  console.log('   • Ensure all data has supabase_user_id values');
  console.log('   • Create a backup before proceeding');
  console.log('   • Test on development/staging first');
  console.log('');

  console.log('📝 To execute the migration:');
  console.log('   Option 1: Use the bash script');
  console.log('     ./scripts/run-clerk-removal-migration.sh');
  console.log('');
  console.log('   Option 2: Use psql directly');
  console.log('     psql $DATABASE_URL -f db/migrations/078_remove_clerk_user_id_complete.sql');
  console.log('');
  console.log('   Option 3: Use Supabase CLI');
  console.log('     supabase db push');
  console.log('');

  console.log('✨ Migration script is ready!');
  console.log('   Review the SQL file and execute when ready.');
}

runMigration().catch(console.error);


