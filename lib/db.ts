import 'dotenv/config';
import postgres from 'postgres';

// Use the original Supabase PostgreSQL database with improved connection pooling
const sql = postgres(process.env.DATABASE_URL!, { 
  ssl: 'require',
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
