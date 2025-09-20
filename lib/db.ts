import { Pool } from "pg";

// re-use a small pool (serverless-friendly)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

export async function dbQuery<T = any>(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}
