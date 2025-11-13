import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function testAdjudicate() {
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
    console.log('🧪 Testing adjudicate system...\n');

    // Test 1: Check if admin_notes column exists
    console.log('Test 1: Checking admin_notes column...');
    const columnCheck = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'auction_awards' 
      AND column_name = 'admin_notes'
    `;
    
    if (columnCheck.length === 0) {
      console.log('❌ admin_notes column does NOT exist');
    } else {
      console.log('✅ admin_notes column exists:', columnCheck[0]);
    }

    // Test 2: Check notifications table schema
    console.log('\nTest 2: Checking notifications table schema...');
    const notificationsSchema = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `;
    console.log('Notifications table columns:');
    notificationsSchema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Test 3: Check loads table schema
    console.log('\nTest 3: Checking loads table schema...');
    const loadsSchema = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loads'
      ORDER BY ordinal_position
    `;
    console.log('Loads table columns:');
    loadsSchema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Test 4: Try to insert a test award
    console.log('\nTest 4: Testing award insertion...');
    try {
      const testAward = await sql`
        INSERT INTO public.auction_awards 
          (bid_number, winner_user_id, winner_amount_cents, awarded_by, admin_notes)
        VALUES ('TEST999', 'test_user', 10000, 'test_admin', 'Test admin notes')
        RETURNING *
      `;
      console.log('✅ Test award inserted successfully:', testAward[0]);
      
      // Clean up
      await sql`DELETE FROM public.auction_awards WHERE bid_number = 'TEST999'`;
      console.log('✅ Test award cleaned up');
    } catch (error) {
      console.error('❌ Test award insertion FAILED:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }

    // Test 5: Try to insert a test notification
    console.log('\nTest 5: Testing notification insertion...');
    try {
      const testNotification = await sql`
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES ('test_user', 'success', 'Test Title', 'Test Body')
        RETURNING *
      `;
      console.log('✅ Test notification inserted successfully:', testNotification[0]);
      
      // Clean up
      await sql`DELETE FROM public.notifications WHERE user_id = 'test_user' AND title = 'Test Title'`;
      console.log('✅ Test notification cleaned up');
    } catch (error) {
      console.error('❌ Test notification insertion FAILED:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }

    // Test 6: Try to insert a test load
    console.log('\nTest 6: Testing load insertion...');
    try {
      const testLoad = await sql`
        INSERT INTO public.loads (rr_number, status_code, meta)
        VALUES ('TEST999', 'awarded', 
                jsonb_build_object('bid_number', 'TEST999', 'carrier_user_id', 'test_user', 'awarded_at', NOW()))
        ON CONFLICT (rr_number) DO NOTHING
        RETURNING *
      `;
      if (testLoad.length > 0) {
        console.log('✅ Test load inserted successfully:', testLoad[0]);
        
        // Clean up
        await sql`DELETE FROM public.loads WHERE rr_number = 'TEST999'`;
        console.log('✅ Test load cleaned up');
      } else {
        console.log('ℹ️ Load already exists or conflict ignored');
      }
    } catch (error) {
      console.error('❌ Test load insertion FAILED:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await sql.end();
  }
}

testAdjudicate();

