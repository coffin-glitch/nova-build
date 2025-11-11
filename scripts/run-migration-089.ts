import 'dotenv/config';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('Running migration 089: Add margin_cents to auction_awards...');
    
    await sql`
      -- Add margin_cents column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'auction_awards' AND column_name = 'margin_cents'
          ) THEN
              ALTER TABLE auction_awards 
              ADD COLUMN margin_cents INTEGER;
              
              COMMENT ON COLUMN auction_awards.margin_cents IS 
                  'Profit margin in cents added by admin when submitting bid to actual auction. NULL if not set.';
              
              CREATE INDEX IF NOT EXISTS idx_auction_awards_margin_cents 
                  ON auction_awards(margin_cents) WHERE margin_cents IS NOT NULL;
              
              RAISE NOTICE 'Added margin_cents column to auction_awards';
          ELSE
              RAISE NOTICE 'Column margin_cents already exists in auction_awards';
          END IF;
      END $$;
    `;
    
    console.log('✅ Migration 089 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

