import 'dotenv/config';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('Creating highway_user_cookies table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS highway_user_cookies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id TEXT NOT NULL,
        cookies_data JSONB NOT NULL,
        extracted_at TIMESTAMP WITH TIME ZONE NOT NULL,
        source_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `;
    
    console.log('Creating indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_highway_user_cookies_user_id ON highway_user_cookies(user_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_highway_user_cookies_extracted_at ON highway_user_cookies(extracted_at)
    `;
    
    console.log('Adding table comments...');
    
    await sql`
      COMMENT ON TABLE highway_user_cookies IS 'Stores Highway.com cookies extracted from user browser sessions for automatic authentication in Playwright scraping'
    `;
    
    await sql`
      COMMENT ON COLUMN highway_user_cookies.cookies_data IS 'JSON array of cookie objects with name, value, domain, path, etc.'
    `;
    
    await sql`
      COMMENT ON COLUMN highway_user_cookies.user_id IS 'User ID from auth system - links cookies to specific admin user'
    `;
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table exists
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'highway_user_cookies'
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

