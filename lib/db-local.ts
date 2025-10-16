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

  // Telegram bids table
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bid_number TEXT NOT NULL UNIQUE,
      distance_miles REAL,
      pickup_timestamp DATETIME,
      delivery_timestamp DATETIME,
      stops TEXT, -- JSON string
      tag TEXT,
      source_channel TEXT NOT NULL,
      forwarded_to TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      published BOOLEAN DEFAULT 1
    )
  `);

  // Loads table (cleaned up - removed unused fields)
      db.exec(`
        CREATE TABLE IF NOT EXISTS loads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rr_number TEXT NOT NULL UNIQUE,
          tm_number TEXT,
          status_code TEXT,
          origin_city TEXT,
          origin_state TEXT,
          destination_city TEXT,
          destination_state TEXT,
          equipment TEXT,
          weight REAL,
          revenue REAL,
          customer_name TEXT,
          customer_ref TEXT,
          driver_name TEXT,
          pickup_date DATE,
          pickup_time TEXT,
          delivery_date DATE,
          delivery_time TEXT,
          stops INTEGER,
          miles INTEGER,
          published BOOLEAN DEFAULT 0,
          archived BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

  // Telegram bid offers table - REMOVED (unused)

  // Load offers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS load_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      load_rr_number TEXT NOT NULL,
      carrier_user_id TEXT NOT NULL,
      offer_amount INTEGER NOT NULL CHECK (offer_amount >= 0),
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
      counter_amount INTEGER,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (load_rr_number) REFERENCES loads(rr_number) ON DELETE CASCADE
    )
  `);

  // Assignments table - REMOVED (unused)

  // Carrier profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS carrier_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      mc_number TEXT,
      dot_number TEXT,
      phone TEXT,
      dispatch_email TEXT,
      company_name TEXT,
      contact_name TEXT,
      is_locked BOOLEAN DEFAULT FALSE,
      locked_at DATETIME,
      locked_by TEXT,
      lock_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add missing columns to existing carrier_profiles table if they don't exist
  try {
    db.exec(`ALTER TABLE carrier_profiles ADD COLUMN contact_name TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    db.exec(`ALTER TABLE carrier_profiles ADD COLUMN is_locked BOOLEAN DEFAULT FALSE`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    db.exec(`ALTER TABLE carrier_profiles ADD COLUMN locked_at DATETIME`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    db.exec(`ALTER TABLE carrier_profiles ADD COLUMN locked_by TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    db.exec(`ALTER TABLE carrier_profiles ADD COLUMN lock_reason TEXT`);
  } catch (e) {
    // Column already exists, ignore error
  }

  // Dedicated lanes table - REMOVED (unused, page uses mock data)
};

// Initialize tables
createTables();

// Insert some sample data
const insertSampleData = () => {
  // Check if data already exists
  const bidCount = db.prepare('SELECT COUNT(*) as count FROM telegram_bids').get() as { count: number };
  
  if (bidCount.count === 0) {
    // Insert sample telegram bids
    const insertBid = db.prepare(`
      INSERT INTO telegram_bids (bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleBids = [
      ['USPS-2024-001', 450, '2024-09-22T08:00:00Z', '2024-09-23T14:00:00Z', '["Atlanta, GA", "Nashville, TN", "Memphis, TN"]', 'GA', 'telegram', '2024-09-22T12:00:00Z'],
      ['USPS-2024-002', 320, '2024-09-22T10:00:00Z', '2024-09-22T18:00:00Z', '["Dallas, TX", "Houston, TX"]', 'TX', 'telegram', '2024-09-22T14:00:00Z'],
      ['USPS-2024-003', 680, '2024-09-22T12:00:00Z', '2024-09-23T16:00:00Z', '["Chicago, IL", "Indianapolis, IN", "Cleveland, OH"]', 'IL', 'telegram', '2024-09-22T16:00:00Z'],
      ['USPS-2024-004', 890, '2024-09-22T14:00:00Z', '2024-09-24T10:00:00Z', '["Los Angeles, CA", "Phoenix, AZ", "Denver, CO", "Kansas City, MO"]', 'CA', 'telegram', '2024-09-22T18:00:00Z'],
      ['USPS-2024-005', 250, '2024-09-22T16:00:00Z', '2024-09-22T22:00:00Z', '["Miami, FL", "Orlando, FL"]', 'FL', 'telegram', '2024-09-22T20:00:00Z']
    ];

    sampleBids.forEach(bid => insertBid.run(bid));

    // Insert sample loads
    const insertLoad = db.prepare(`
      INSERT INTO loads (rr_number, origin_city, origin_state, destination_city, destination_state, equipment, weight, rate_cents, pickup_date, delivery_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleLoads = [
      ['RR-001', 'Atlanta', 'GA', 'Dallas', 'TX', 'Dry Van', 45000, 285000, '2024-09-23', '2024-09-24'],
      ['RR-002', 'Chicago', 'IL', 'Detroit', 'MI', 'Reefer', 38000, 320000, '2024-09-23', '2024-09-24'],
      ['RR-003', 'Los Angeles', 'CA', 'Phoenix', 'AZ', 'Flatbed', 42000, 180000, '2024-09-23', '2024-09-24']
    ];

    sampleLoads.forEach(load => insertLoad.run(load));

    // Insert sample user roles
    const insertRole = db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)');
    insertRole.run('admin_user', 'admin');
    insertRole.run('carrier_user', 'carrier');
  }
};

// Insert sample data
insertSampleData();

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

// Add template literal support
const sqlTemplate = (strings: TemplateStringsArray, ...values: any[]) => {
  let query = strings[0];
  for (let i = 0; i < values.length; i++) {
    query += '?' + strings[i + 1];
  }
  return sql(query, ...values);
};

// Export both the database and the query function
export default sqlTemplate;
export { db };
