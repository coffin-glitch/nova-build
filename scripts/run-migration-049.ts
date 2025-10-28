import 'dotenv/config';
import { readFileSync } from 'fs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running migration 049: Fix bid_lifecycle_events id column\n');

  const migrationSQL = readFileSync('db/migrations/049_fix_bid_lifecycle_events_id_column.sql', 'utf-8');

  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {},
  });

  try {
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 049 completed successfully!');
    console.log('\nThe bid_lifecycle_events table now uses UUID for id column.');
    console.log('This should fix the "Failed to create lifecycle event" error.\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

