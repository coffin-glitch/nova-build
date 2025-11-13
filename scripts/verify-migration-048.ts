import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function verifyMigration() {
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
    const result = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'auction_awards' 
      AND column_name = 'admin_notes'
    `;

    if (result.length > 0) {
      console.log('✅ Verification successful!');
      console.log('\nColumn details:');
      console.log(result[0]);
      console.log('\n✅ The admin_notes column exists and is ready to use.');
    } else {
      console.log('❌ Verification failed!');
      console.log('The admin_notes column was not found.');
    }
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await sql.end();
  }
}

verifyMigration();

