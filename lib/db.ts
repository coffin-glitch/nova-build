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
    max: Number(process.env.PG_POOL_MAX || 50), // Increased for notification system scalability
    idle_timeout: Number(process.env.PG_IDLE_TIMEOUT || 20),
    connect_timeout: Number(process.env.PG_CONNECT_TIMEOUT || 30),
    max_lifetime: Number(process.env.PG_MAX_LIFETIME || 60 * 30),
    onnotice: () => {},
    debug: false,
    prepare: false, // Disable prepared statements to avoid "prepared statement does not exist" errors with connection pooling
  });
}

const sql = g.__pg_sql_client as ReturnType<typeof postgres>;

export default sql;

// Legacy function aliases for backward compatibility
export const dbQuery = sql;
export const useLocalDb = sql;
