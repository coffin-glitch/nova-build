import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function checkTable() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {},
  });

  try {
    console.log('🔍 Checking bid_lifecycle_events table structure...\n');

    // Get all columns with their constraints
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'bid_lifecycle_events'
      ORDER BY ordinal_position
    `;
    
    console.log('Table structure:');
    columns.forEach(col => {
      console.log(`\n${col.column_name}:`);
      console.log(`  - Type: ${col.data_type}`);
      console.log(`  - Nullable: ${col.is_nullable}`);
      console.log(`  - Default: ${col.column_default || 'NONE'}`);
    });

    // Check if uuid extension is enabled
    console.log('\n\n🔍 Checking UUID extension...');
    const uuidExtension = await sql`
      SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'
    `;
    
    if (uuidExtension.length === 0) {
      console.log('⚠️ uuid-ossp extension not enabled');
      console.log('This might cause UUID generation issues');
    } else {
      console.log('✅ uuid-ossp extension enabled');
    }

    // Try to see current ID values in table
    console.log('\n\n🔍 Checking existing records...');
    const existing = await sql`
      SELECT id, bid_id, event_type, timestamp 
      FROM bid_lifecycle_events 
      ORDER BY timestamp DESC 
      LIMIT 5
    `;
    
    if (existing.length > 0) {
      console.log('Existing records:');
      existing.forEach(rec => {
        console.log(`  - ID: ${rec.id}, Bid: ${rec.bid_id}, Type: ${rec.event_type}`);
      });
    } else {
      console.log('No existing records');
    }

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    await sql.end();
  }
}

checkTable();

