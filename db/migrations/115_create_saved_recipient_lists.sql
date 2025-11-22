-- Migration: Create saved recipient lists for announcements
-- Description: Allows admins to save and reuse recipient selections for announcements

-- Create saved_recipient_lists table
CREATE TABLE IF NOT EXISTS saved_recipient_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL, -- Admin user ID (Supabase auth.users.id)
  recipient_user_ids UUID[] NOT NULL DEFAULT '{}', -- Array of carrier user IDs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(created_by, name) -- Prevent duplicate names for same admin
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_recipient_lists_created_by ON saved_recipient_lists(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_recipient_lists_name ON saved_recipient_lists(name);

-- Add comments
COMMENT ON TABLE saved_recipient_lists IS 'Saved recipient lists for announcements, allowing admins to reuse recipient selections';
COMMENT ON COLUMN saved_recipient_lists.recipient_user_ids IS 'Array of UUIDs representing carrier user IDs';

