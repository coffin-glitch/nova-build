/**
 * Run migration 120 directly using postgres.js
 * Creates the DNU tracking table
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  // Import sql after env vars are loaded
  const { default: sql } = await import('../lib/db');
  const migrationFile = path.join(process.cwd(), 'db/migrations/120_create_dnu_tracking_table.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('🔄 Running migration 120: Create DNU Tracking Table...\n');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    console.log('📄 Executing migration SQL...\n');
    
    // Execute the SQL directly
    await sql.unsafe(sqlContent);

    console.log('✅ Migration 120 completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   - Created dnu_tracking table');
    console.log('   - Added indexes for quick lookups');
    console.log('   - Added trigger for auto-updating updated_at');
    console.log('   - Ready for DNU list uploads\n');

    // Verify the table was created
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'dnu_tracking'
    `;

    if (result.length > 0) {
      console.log('✅ Verification: dnu_tracking table exists\n');
    }

    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    console.error('Error details:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigration();

