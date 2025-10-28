-- Migration 048: Add admin_notes column to auction_awards table
-- Description: Adds admin_notes column to store optional notes from admins when awarding auctions

-- Add admin_notes column to auction_awards table
ALTER TABLE auction_awards 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN auction_awards.admin_notes IS 'Optional notes from admin when adjudicating/awarding an auction';

