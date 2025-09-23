import 'dotenv/config';
import postgres from 'postgres';

// Single cached postgres client for server-side operations
const sql = postgres(process.env.DATABASE_URL!, { 
  ssl: 'require',
  max: 1, // Single connection for server operations
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
