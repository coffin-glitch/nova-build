// Load environment variables - check .env.local first, then .env
import { config } from 'dotenv';
import { resolve } from 'path';

// Try .env.local first (common for local development)
config({ path: resolve(process.cwd(), '.env.local') });
// Fall back to .env
config({ path: resolve(process.cwd(), '.env') });
// Also try default dotenv/config behavior
config();

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

// Global singleton to prevent HMR creating multiple pools
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = globalThis as any;

// Use the PostgreSQL database with improved connection pooling
// Add search_path to ensure we use the public schema
const dbUrl = process.env.DATABASE_URL || '';
const pooledUrl = dbUrl.includes('?') ? `${dbUrl}&options=-csearch_path%3Dpublic` : `${dbUrl}?options=-csearch_path%3Dpublic`;

if (!g.__pg_sql_client) {
  g.__pg_sql_client = postgres(pooledUrl, {
    ssl: dbUrl.includes('localhost') ? false : 'require',
    // Connection pool configuration for 10k users
    // Recommended: PG_POOL_MAX=250 (see DATABASE_POOL_AND_RATE_LIMITING_ANALYSIS.md)
    max: Number(process.env.PG_POOL_MAX || 50), // Default: 50, Recommended: 250 for 10k users
    idle_timeout: Number(process.env.PG_IDLE_TIMEOUT || 30), // Keep idle connections 30s
    connect_timeout: Number(process.env.PG_CONNECT_TIMEOUT || 10), // Faster connection timeout
    max_lifetime: Number(process.env.PG_MAX_LIFETIME || 3600), // 1 hour max connection lifetime
    onnotice: () => {},
    debug: false,
    prepare: false, // Disable prepared statements to avoid "prepared statement does not exist" errors with connection pooling
    transform: {
      undefined: null, // Transform undefined to null for SQL parameters
    },
  });
}

const sql = g.__pg_sql_client as ReturnType<typeof postgres>;

export default sql;

// Legacy function aliases for backward compatibility
export const dbQuery = sql;
export const useLocalDb = sql;
