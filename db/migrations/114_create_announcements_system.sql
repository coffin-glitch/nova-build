-- Migration: Create announcements system
-- Description: Adds tables for admin announcements to carriers with read tracking

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by UUID NOT NULL, -- Admin user ID (Supabase auth.users.id)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration date
  is_active BOOLEAN NOT NULL DEFAULT true,
  target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'active_carriers')), -- Future: specific_groups
  metadata JSONB DEFAULT '{}'::jsonb -- For future extensibility
);

-- Create announcement_reads table to track which carriers have read each announcement
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  carrier_user_id VARCHAR(255) NOT NULL, -- Supabase carrier user ID
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(announcement_id, carrier_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_carrier ON announcement_reads(carrier_user_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

-- Add comments
COMMENT ON TABLE announcements IS 'System announcements created by admins for carriers';
COMMENT ON TABLE announcement_reads IS 'Tracks which carriers have read each announcement';

-- Update notification types to include 'announcement'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- Existing types
  'bid_won', 
  'bid_lost', 
  'bid_expired', 
  'load_assigned', 
  'bid_received', 
  'system', 
  'info',
  -- Admin notification types
  'new_lowest_bid',
  'carrier_message',
  'bid_message',
  'profile_submission',
  'bid_accepted',
  -- Carrier notification types
  'admin_message',
  'profile_approved',
  'profile_declined',
  -- Favorites notification types
  'exact_match',
  'state_match',
  'state_pref_bid',
  'similar_load',
  'favorite_available',
  -- Announcements
  'announcement'  -- NEW: System announcements
));

