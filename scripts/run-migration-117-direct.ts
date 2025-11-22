import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  // Import sql after env vars are loaded
  const { default: sql } = await import('../lib/db');
  const migrationFile = path.join(process.cwd(), 'db/migrations/117_fix_notification_type_constraint.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('Running migration 117: Fix notification type constraint to include bid_expired_needs_award...');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    // Execute the SQL directly - it's safe since it's a migration file we control
    await sql.unsafe(sqlContent);
    
    console.log('✅ Migration 117 completed successfully');
    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    await sql.end();
    process.exit(1);
  }
}

runMigration();

