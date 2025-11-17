import 'dotenv/config';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('Creating highway_carrier_data table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS highway_carrier_data (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mc_number TEXT NOT NULL,
        carrier_name TEXT NOT NULL,
        carrier_id TEXT NOT NULL,
        carrier_url TEXT NOT NULL,
        scraped_data JSONB NOT NULL,
        scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(mc_number, carrier_id)
      )
    `;
    
    console.log('Creating indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_mc_number ON highway_carrier_data(mc_number)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_carrier_id ON highway_carrier_data(carrier_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_highway_carrier_data_scraped_at ON highway_carrier_data(scraped_at)
    `;
    
    console.log('Adding table comments...');
    
    await sql`
      COMMENT ON TABLE highway_carrier_data IS 'Cached carrier health data scraped from Highway.com'
    `;
    
    await sql`
      COMMENT ON COLUMN highway_carrier_data.scraped_data IS 'JSON object containing all scraped carrier health metrics and information'
    `;
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table exists
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'highway_carrier_data'
    `;
    
    if (result[0].count > 0) {
      console.log('✅ Table verified and ready to use!');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

