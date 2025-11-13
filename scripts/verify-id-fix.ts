import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function verifyIdFix() {
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
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bid_lifecycle_events' 
      AND column_name = 'id'
    `;
    
    if (result.length > 0) {
      console.log('✅ id column exists:');
      console.log('  - Type:', result[0].data_type);
      console.log('  - Default:', result[0].column_default || 'NONE');
      
      if (result[0].data_type === 'uuid') {
        console.log('\n✅ Migration successful! id is now UUID');
      } else {
        console.log('\n⚠️ id is not UUID yet, it is:', result[0].data_type);
      }
    } else {
      console.log('❌ id column not found!');
    }
    
    await sql.end();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

verifyIdFix();

