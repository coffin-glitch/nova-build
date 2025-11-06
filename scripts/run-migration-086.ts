import 'dotenv/config';
import sql from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(process.cwd(), 'db/migrations/086_update_notification_types.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('Running migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration 086 completed successfully!');
    console.log('The notification types have been updated and indexes created.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  }
}

runMigration();

