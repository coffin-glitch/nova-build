import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

async function runMigration() {
  const migrationFile = path.join(process.cwd(), 'db/migrations/088_add_bid_expired_needs_award_notification_type.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('Running migration 088: Add bid_expired_needs_award notification type...');
    
    const { stdout, stderr } = await execAsync(`psql "${databaseUrl}" -f "${migrationFile}"`);
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.error('Migration stderr:', stderr);
    }
    
    if (stdout) {
      console.log('Migration output:', stdout);
    }
    
    console.log('✅ Migration 088 completed successfully');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    process.exit(1);
  }
}

runMigration();

