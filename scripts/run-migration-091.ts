import 'dotenv/config';
import sql from '../lib/db';

async function runMigration() {
  try {
    console.log('Running migration 091: Add urgent_contact_email and urgent_contact_phone columns...');
    
    await sql`
      -- Add urgent_contact_email column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carrier_notification_preferences' AND column_name = 'urgent_contact_email'
          ) THEN
              ALTER TABLE carrier_notification_preferences 
              ADD COLUMN urgent_contact_email BOOLEAN DEFAULT true;
              
              COMMENT ON COLUMN carrier_notification_preferences.urgent_contact_email IS 
                  'Whether carrier wants to be contacted via email for urgent matters. Default: true.';
          END IF;
      END $$;
    `;
    
    await sql`
      -- Add urgent_contact_phone column if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carrier_notification_preferences' AND column_name = 'urgent_contact_phone'
          ) THEN
              ALTER TABLE carrier_notification_preferences 
              ADD COLUMN urgent_contact_phone BOOLEAN DEFAULT false;
              
              COMMENT ON COLUMN carrier_notification_preferences.urgent_contact_phone IS 
                  'Whether carrier wants to be contacted via phone for urgent matters. Default: false.';
          END IF;
      END $$;
    `;
    
    await sql`
      -- Update existing records based on urgent_contact_preference
      UPDATE carrier_notification_preferences
      SET 
          urgent_contact_email = CASE 
              WHEN urgent_contact_preference = 'email' OR urgent_contact_preference = 'both' THEN true
              ELSE false
          END,
          urgent_contact_phone = CASE 
              WHEN urgent_contact_preference = 'phone' OR urgent_contact_preference = 'both' THEN true
              ELSE false
          END
      WHERE urgent_contact_email IS NULL OR urgent_contact_phone IS NULL;
    `;
    
    console.log('✅ Migration 091 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

