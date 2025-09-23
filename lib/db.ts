import 'dotenv/config';
import postgres from 'postgres';

// Use the original Supabase PostgreSQL database
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

export default sql;

// Legacy function aliases for backward compatibility
export const dbQuery = sql;
export const useLocalDb = sql;
