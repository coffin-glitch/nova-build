import 'dotenv/config';
import postgres from 'postgres';

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(`
    DATABASE_URL environment variable is not set!
    
    Please create a .env.local file with your PostgreSQL connection string:
    DATABASE_URL=postgresql://username:password@localhost:5432/nova_build
    
    Or use a cloud provider like Supabase:
    DATABASE_URL=postgresql://postgres:[password]@[host]:5432/[database]
    
    Then run the migration:
    psql $DATABASE_URL -f db/migrations/012_complete_postgres_schema.sql
  `);
}

// Use the PostgreSQL database with improved connection pooling
const sql = postgres(process.env.DATABASE_URL, { 
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : 'require',
  max: 5, // Allow multiple connections for better performance
  idle_timeout: 60, // Keep connections alive longer
  connect_timeout: 30, // Longer connection timeout
  max_lifetime: 60 * 30, // 30 minutes max lifetime
  onnotice: () => {}, // Suppress notices
  debug: false, // Disable debug logging
});

export default sql;

// Legacy function aliases for backward compatibility
export const dbQuery = sql;
export const useLocalDb = sql;
