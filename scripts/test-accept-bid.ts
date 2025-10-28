import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function testAcceptBid() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {},
  });

  try {
    console.log('🧪 Testing Accept Bid functionality...\n');

    // Test 1: Check bid_lifecycle_events table schema
    console.log('Test 1: Checking bid_lifecycle_events table schema...');
    const schema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'bid_lifecycle_events'
      ORDER BY ordinal_position
    `;
    console.log('bid_lifecycle_events columns:');
    schema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Test 2: Check carrier_bids table schema
    console.log('\nTest 2: Checking carrier_bids table schema...');
    const carrierBidsSchema = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'carrier_bids'
      AND column_name LIKE 'driver_%' OR column_name LIKE 'second_%'
      ORDER BY column_name
    `;
    console.log('carrier_bids driver info columns:');
    carrierBidsSchema.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

    // Test 3: Try to insert a test lifecycle event
    console.log('\nTest 3: Testing lifecycle event insertion...');
    try {
      const testEvent = await sql`
        INSERT INTO bid_lifecycle_events (
          bid_id,
          event_type,
          event_data,
          notes,
          timestamp
        )
        VALUES (
          'TEST999',
          'bid_awarded',
          '{"test": true}',
          'Test acceptance',
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
      console.log('✅ Test lifecycle event inserted:', testEvent[0]);
      
      // Clean up
      await sql`DELETE FROM bid_lifecycle_events WHERE bid_id = 'TEST999'`;
      console.log('✅ Test event cleaned up');
    } catch (error) {
      console.error('❌ Test lifecycle event insertion FAILED:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error code:', (error as any).code);
      }
    }

    // Test 4: Try with all driver columns
    console.log('\nTest 4: Testing lifecycle event with driver info...');
    try {
      const testEventWithDriver = await sql`
        INSERT INTO bid_lifecycle_events (
          bid_id,
          event_type,
          event_data,
          notes,
          driver_name,
          driver_phone,
          driver_email,
          driver_license_number,
          driver_license_state,
          truck_number,
          trailer_number,
          timestamp
        )
        VALUES (
          'TEST999',
          'bid_awarded',
          '{"test": true}',
          'Test with driver info',
          'John Doe',
          '555-1234',
          'john@test.com',
          'DL123456',
          'TX',
          'TRUCK001',
          'TRAILER001',
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `;
      console.log('✅ Test lifecycle event with driver info inserted:', testEventWithDriver[0]);
      
      // Clean up
      await sql`DELETE FROM bid_lifecycle_events WHERE bid_id = 'TEST999'`;
      console.log('✅ Test event cleaned up');
    } catch (error) {
      console.error('❌ Test lifecycle event with driver info FAILED:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error code:', (error as any).code);
      }
    }

    // Test 5: Check if columns exist that might be missing
    console.log('\nTest 5: Checking for missing columns...');
    const requiredColumns = [
      'id', 'bid_id', 'event_type', 'event_data', 'timestamp', 'notes',
      'driver_name', 'driver_phone', 'truck_number'
    ];
    
    for (const col of requiredColumns) {
      const exists = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'bid_lifecycle_events' 
        AND column_name = ${col}
      `;
      if (exists.length === 0) {
        console.log(`❌ Missing column: ${col}`);
      } else {
        console.log(`✅ Column exists: ${col}`);
      }
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await sql.end();
  }
}

testAcceptBid();

