import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(process.cwd(), '.env.local') });

import sql from '../lib/db';

async function runMigration() {
  const migrationFile = path.join(process.cwd(), 'db/migrations/117_fix_notification_type_constraint.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  try {
    console.log('Running migration 117: Fix notification type constraint to include bid_expired_needs_award...');
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await sql.unsafe(statement);
      }
    }
    
    console.log('✅ Migration 117 completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

runMigration();

