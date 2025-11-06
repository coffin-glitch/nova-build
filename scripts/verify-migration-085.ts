import 'dotenv/config';
import sql from '@/lib/db';

async function verifyMigration() {
  try {
    console.log('Verifying migration 085...');
    
    // Check if columns exist
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversation_messages' 
      AND column_name IN ('attachment_url', 'attachment_type', 'attachment_name', 'attachment_size')
      ORDER BY column_name;
    `;
    
    console.log('\n✅ Found attachment columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    if (columns.length === 4) {
      console.log('\n✅ All 4 attachment columns are present!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  Expected 4 columns, found ${columns.length}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();

