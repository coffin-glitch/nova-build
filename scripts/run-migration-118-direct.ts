/**
 * Run migration 118 directly using postgres.js
 * Adds 'backhaul' notification type to the constraint
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  // Import sql after env vars are loaded
  const { default: sql } = await import('../lib/db');
  const migrationFile = path.join(process.cwd(), 'db/migrations/118_add_backhaul_notification_type.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('🔄 Running migration 118: Add backhaul notification type...\n');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    console.log('📄 Executing migration SQL...\n');
    
    // Execute the SQL directly - it's safe since it's a migration file we control
    await sql.unsafe(sqlContent);
    
    console.log('✅ Migration 118 completed successfully!');
    console.log('   - Added \'backhaul\' to notification type constraint\n');

    // Verify the constraint
    const result = await sql`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'notifications_type_check'
    `;

    if (result.length > 0) {
      console.log('✅ Verification: Constraint exists');
      const checkClause = result[0].check_clause;
      if (checkClause.includes("'backhaul'")) {
        console.log('   ✅ \'backhaul\' type is present in constraint\n');
      } else {
        console.log('   ⚠️  \'backhaul\' type not found in constraint\n');
      }
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

