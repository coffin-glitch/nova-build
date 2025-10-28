import 'dotenv/config';
import { readFileSync } from 'fs';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running migration 050: Create bid_messages table\n');

  const migrationSQL = readFileSync('db/migrations/050_create_bid_messages_table.sql', 'utf-8');

  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {},
  });

  try {
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 050 completed successfully!');
    console.log('\nThe bid_messages table has been created.');
    console.log('Ready to wire up bid messaging system.\n');
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

