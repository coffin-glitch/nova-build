import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

async function runMigration() {
  // Import sql after env vars are loaded
  const { default: sql } = await import('../lib/db');
  const migrationFile = path.join(process.cwd(), 'db/migrations/092_add_use_min_match_score_filter.sql');
  const fs = await import('fs');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('Running migration 092: Add use_min_match_score_filter column...');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    // Execute the SQL directly
    await sql.unsafe(sqlContent);
    
    console.log('✅ Migration 092 completed successfully');
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

