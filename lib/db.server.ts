import Database from 'better-sqlite3';
import 'dotenv/config';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Create database directory if it doesn't exist
const dbDir = join(process.cwd(), 'storage');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(join(dbDir, 'nova-build.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
const createTables = () => {
  // User roles table (legacy)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'carrier')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User roles cache table (centralized)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles_cache (
      clerk_user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('admin', 'carrier', 'none')),
      email TEXT NOT NULL,
      last_synced DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      clerk_updated_at INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Loads table with all required columns (cleaned up - removed unused fields)
  db.exec(`
    CREATE TABLE IF NOT EXISTS loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rr_number TEXT NOT NULL UNIQUE,
      tm_number TEXT,
      status_code TEXT DEFAULT 'active',
      origin_city TEXT,
      origin_state TEXT,
      destination_city TEXT,
      destination_state TEXT,
      equipment TEXT,
      revenue REAL,
      customer_name TEXT,
      driver_name TEXT,
      pickup_date DATE,
      pickup_window TEXT,
      delivery_date DATE,
      delivery_window TEXT,
      total_miles INTEGER,
      published BOOLEAN DEFAULT 0,
      archived BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert some sample loads if none exist
  const loadCount = db.prepare('SELECT COUNT(*) as count FROM loads').get() as { count: number };
  
  if (loadCount.count === 0) {
    const insertLoad = db.prepare(`
      INSERT INTO loads (rr_number, tm_number, status_code, origin_city, origin_state, destination_city, destination_state, equipment, revenue, purchase, net, margin, customer_name, driver_name, total_miles, pickup_date, delivery_date, published, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleLoads = [
      ['4039008', '3060', 'active', 'OAK CREEK', 'WI', 'KANSAS CITY', 'MO', 'Dry Van', 1060.00, 0, 0, 0, '84913117', 'DRIVER NOT ASSIGNED', 0, '2025-10-04', '2025-10-04', 1, '2025-10-07 22:13:06'],
      ['4039009', '3061', 'published', 'CHICAGO', 'IL', 'DETROIT', 'MI', 'Reefer', 2500.00, 2000.00, 500.00, 500.00, 'Customer A', 'John Driver', 300, '2025-10-05', '2025-10-06', 1, '2025-10-07 22:13:06'],
      ['4039010', '3062', 'completed', 'LOS ANGELES', 'CA', 'PHOENIX', 'AZ', 'Flatbed', 1800.00, 1500.00, 300.00, 300.00, 'Customer B', 'Jane Driver', 400, '2025-10-03', '2025-10-04', 1, '2025-10-07 22:13:06'],
    ];

    sampleLoads.forEach(load => insertLoad.run(load));
  }
};

// Initialize tables
createTables();

// Create a simple query interface that mimics the postgres library
const sql = (query: string, ...params: any[]) => {
  try {
    if (query.includes('SELECT') || query.includes('select')) {
      const stmt = db.prepare(query);
      return stmt.all(...params);
    } else {
      const stmt = db.prepare(query);
      return stmt.run(...params);
    }
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
};

// Type definitions for SQLite results
interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

interface SelectResult extends Array<Record<string, unknown>> {}

type QueryResult = RunResult | SelectResult;

// Add template literal support
const sqlTemplate = (strings: TemplateStringsArray, ...values: unknown[]) => {
  let query = strings[0];
  for (let i = 0; i < values.length; i++) {
    query += '?' + strings[i + 1];
  }
  return sql(query, ...values) as QueryResult;
};

// Export both functions
export { sql };
export default sqlTemplate;
