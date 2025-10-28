import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('\nPlease set DATABASE_URL in your .env.local file');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 Running migration 048: Add admin_notes to auction_awards\n');

  // Read the migration file
  const migrationSQL = readFileSync('db/migrations/048_add_admin_notes_to_auction_awards.sql', 'utf-8');

  // Create database connection
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {}, // Suppress notices
  });

  try {
    // Run the migration
    await sql.unsafe(migrationSQL);
    console.log('✅ Migration 048 completed successfully!');
    console.log('\nThe admin_notes column has been added to auction_awards table.');
    console.log('The adjudicate system is now fully functional.\n');
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

