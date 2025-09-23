-- Migration 006: Auctions and Bidding System
-- Creates carrier profiles, bidding system, and auction awards

-- Ensure telegram_bids has proper constraints
ALTER TABLE public.telegram_bids 
ADD CONSTRAINT telegram_bids_bid_number_unique UNIQUE (bid_number);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_bids_received_at_desc 
ON public.telegram_bids (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_bids_bid_number 
ON public.telegram_bids (bid_number);

-- Carrier profiles table
CREATE TABLE IF NOT EXISTS public.carrier_profiles (
    clerk_user_id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    mc_number TEXT UNIQUE NOT NULL,
    dot_number TEXT UNIQUE,
    phone TEXT,
    contact_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carrier bids table (carrier's price for a Telegram Bid)
CREATE TABLE IF NOT EXISTS public.carrier_bids (
    id BIGSERIAL PRIMARY KEY,
    bid_number TEXT NOT NULL,
    clerk_user_id TEXT NOT NULL REFERENCES public.carrier_profiles(clerk_user_id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bid_number, clerk_user_id)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_amount 
ON public.carrier_bids (bid_number, amount_cents ASC);

CREATE INDEX IF NOT EXISTS idx_carrier_bids_user_id 
ON public.carrier_bids (clerk_user_id);

-- Auction awards table (admin adjudication result)
CREATE TABLE IF NOT EXISTS public.auction_awards (
    id BIGSERIAL PRIMARY KEY,
    bid_number TEXT NOT NULL UNIQUE,
    winner_user_id TEXT NOT NULL REFERENCES public.carrier_profiles(clerk_user_id),
    winner_amount_cents INTEGER NOT NULL,
    awarded_by TEXT NOT NULL, -- admin clerk_user_id
    awarded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
ON public.notifications (recipient_user_id, read_at) WHERE read_at IS NULL;

-- Helper view for auction lowest bids
CREATE OR REPLACE VIEW public.v_auction_lowest_bids AS
SELECT 
    tb.bid_number,
    tb.received_at,
    tb.received_at + INTERVAL '25 minutes' as expires_at_25,
    NOW() > (tb.received_at + INTERVAL '25 minutes') as is_expired,
    COALESCE(lowest_bid.amount_cents, 0) as lowest_amount_cents,
    lowest_bid.clerk_user_id as lowest_user_id,
    COALESCE(bid_counts.bids_count, 0) as bids_count
FROM public.telegram_bids tb
LEFT JOIN (
    SELECT 
        bid_number,
        amount_cents,
        clerk_user_id,
        ROW_NUMBER() OVER (PARTITION BY bid_number ORDER BY amount_cents ASC) as rn
    FROM public.carrier_bids
) lowest_bid ON tb.bid_number = lowest_bid.bid_number AND lowest_bid.rn = 1
LEFT JOIN (
    SELECT 
        bid_number,
        COUNT(*) as bids_count
    FROM public.carrier_bids
    GROUP BY bid_number
) bid_counts ON tb.bid_number = bid_counts.bid_number;

-- Function to update carrier_bids updated_at
CREATE OR REPLACE FUNCTION update_carrier_bids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for carrier_bids updated_at
DROP TRIGGER IF EXISTS trigger_carrier_bids_updated_at ON public.carrier_bids;
CREATE TRIGGER trigger_carrier_bids_updated_at
    BEFORE UPDATE ON public.carrier_bids
    FOR EACH ROW
    EXECUTE FUNCTION update_carrier_bids_updated_at();

-- Insert sample carrier profile for testing (optional)
-- INSERT INTO public.carrier_profiles (clerk_user_id, legal_name, mc_number, phone, contact_name)
-- VALUES ('test_carrier_1', 'Test Carrier LLC', 'MC123456', '555-0123', 'John Doe')
-- ON CONFLICT (clerk_user_id) DO NOTHING;
