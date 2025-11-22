/**
 * Run migration 119 directly using postgres.js
 * This updates the MC access control trigger to restore carriers to approved when MC is enabled
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  // Import sql after env vars are loaded
  const { default: sql } = await import('../lib/db');
  const migrationFile = path.join(process.cwd(), 'db/migrations/119_update_mc_access_trigger_restore_approved.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('🔄 Running migration 119: Update MC Access Control Trigger...\n');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    console.log('📄 Executing migration SQL...\n');
    
    // Execute the SQL directly
    await sql.unsafe(sqlContent);

    console.log('✅ Migration 119 completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   - Updated disable_carriers_for_mc() function');
    console.log('   - When MC is enabled, carriers declined due to MC disable are restored to "approved"');
    console.log('   - This ensures carriers are fully re-enabled when their MC is re-enabled');
    
    // Verify the function was updated
    const result = await sql`
      SELECT pg_get_functiondef(oid) as function_def
      FROM pg_proc
      WHERE proname = 'disable_carriers_for_mc'
    `;

    if (result.length > 0) {
      const functionDef = result[0].function_def;
      if (functionDef.includes("profile_status = 'approved'")) {
        console.log('\n✅ Verification: Function updated correctly');
        console.log('   ✅ Carriers will be restored to "approved" when MC is enabled\n');
      } else {
        console.log('\n⚠️  Verification: Function may not have been updated correctly\n');
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

