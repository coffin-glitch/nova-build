import sql from "@/lib/db";

async function runMigration() {
  try {
    console.log("Running carrier profile approval workflow migration...");
    
    // Add approval workflow fields to carrier_profiles
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS profile_status TEXT DEFAULT 'pending' CHECK (profile_status IN ('pending', 'approved', 'declined'))
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS reviewed_by TEXT
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS review_notes TEXT
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS decline_reason TEXT
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled BOOLEAN DEFAULT false
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled_by TEXT
    `;
    
    await sql`
      ALTER TABLE carrier_profiles ADD COLUMN IF NOT EXISTS edits_enabled_at TIMESTAMP
    `;

    // Create carrier_profile_history table
    await sql`
      CREATE TABLE IF NOT EXISTS carrier_profile_history (
        id SERIAL PRIMARY KEY,
        carrier_user_id TEXT NOT NULL,
        profile_data JSONB NOT NULL,
        profile_status TEXT NOT NULL CHECK (profile_status IN ('pending', 'approved', 'declined')),
        submitted_at TIMESTAMP NOT NULL,
        reviewed_at TIMESTAMP,
        reviewed_by TEXT,
        review_notes TEXT,
        decline_reason TEXT,
        version_number INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create admin_profile_actions table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_profile_actions (
        id SERIAL PRIMARY KEY,
        carrier_user_id TEXT NOT NULL,
        admin_user_id TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('approve', 'decline', 'enable_edits', 'disable_edits', 'unlock_profile')),
        action_data JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profiles_status ON carrier_profiles(profile_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profiles_first_login ON carrier_profiles(is_first_login)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profiles_edits_enabled ON carrier_profiles(edits_enabled)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profiles_reviewed_by ON carrier_profiles(reviewed_by)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_user_id ON carrier_profile_history(carrier_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_status ON carrier_profile_history(profile_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carrier_profile_history_submitted_at ON carrier_profile_history(submitted_at)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_carrier ON admin_profile_actions(carrier_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_admin ON admin_profile_actions(admin_user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_profile_actions_type ON admin_profile_actions(action_type)`;

    // Update existing profiles to have default status
    await sql`
      UPDATE carrier_profiles 
      SET profile_status = 'approved', 
          submitted_at = created_at,
          reviewed_at = created_at,
          is_first_login = false,
          profile_completed_at = created_at
      WHERE profile_status IS NULL
    `;

    console.log("Migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

runMigration();
