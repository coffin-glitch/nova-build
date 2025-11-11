import 'dotenv/config';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('Running migration 090: Add toast and text notification preferences...');
    
    await sql`
      -- Add toast_notifications column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carrier_notification_preferences' AND column_name = 'toast_notifications'
          ) THEN
              ALTER TABLE carrier_notification_preferences 
              ADD COLUMN toast_notifications BOOLEAN DEFAULT true;
              
              COMMENT ON COLUMN carrier_notification_preferences.toast_notifications IS 
                  'Enable/disable in-app toast notifications. Default: true.';
          END IF;
      END $$;
    `;
    
    await sql`
      -- Add text_notifications column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carrier_notification_preferences' AND column_name = 'text_notifications'
          ) THEN
              ALTER TABLE carrier_notification_preferences 
              ADD COLUMN text_notifications BOOLEAN DEFAULT false;
              
              COMMENT ON COLUMN carrier_notification_preferences.text_notifications IS 
                  'Enable/disable SMS text notifications. Default: false (coming soon).';
          END IF;
      END $$;
    `;
    
    await sql`
      -- Add urgent_contact_preference column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carrier_notification_preferences' AND column_name = 'urgent_contact_preference'
          ) THEN
              ALTER TABLE carrier_notification_preferences 
              ADD COLUMN urgent_contact_preference TEXT DEFAULT 'email';
              
              COMMENT ON COLUMN carrier_notification_preferences.urgent_contact_preference IS 
                  'Preferred method for urgent contact: email or phone. Default: email.';
          END IF;
      END $$;
    `;
    
    console.log('✅ Migration 090 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

