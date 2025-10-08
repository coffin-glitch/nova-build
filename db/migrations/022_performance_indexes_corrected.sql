-- Performance optimization indexes for Nova Build (Corrected for actual schema)
-- Run these SQL commands to improve database performance

-- Indexes for telegram_bids table (corrected schema)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_received_at_desc 
ON public.telegram_bids (received_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_source_channel 
ON public.telegram_bids (source_channel);

-- Indexes for carrier_bids table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_bids_bid_number_amount 
ON public.carrier_bids (bid_number, amount_cents ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_bids_user_id 
ON public.carrier_bids (clerk_user_id);

-- Additional indexes for loads table (many already exist, adding missing ones)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_created_at 
ON public.loads (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_updated_at 
ON public.loads (updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_rate 
ON public.loads (rate);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_total_miles 
ON public.loads (total_miles);

-- Indexes for load_offers table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_rr_number 
ON public.load_offers (rr_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_carrier_user_id 
ON public.load_offers (carrier_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_status 
ON public.load_offers (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_created_at 
ON public.load_offers (created_at DESC);

-- Indexes for assignments table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_rr_number 
ON public.assignments (rr_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_user_id 
ON public.assignments (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_status 
ON public.assignments (status);

-- Indexes for carrier_profiles table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_profiles_user_id 
ON public.carrier_profiles (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_profiles_mc_number 
ON public.carrier_profiles (mc_number);

-- Indexes for user_roles table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_id 
ON public.user_roles (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_role 
ON public.user_roles (role);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loads_published_recent 
ON public.loads (published, created_at DESC) 
WHERE published = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_bids_recent_active 
ON public.telegram_bids (received_at DESC, bid_number) 
WHERE received_at > NOW() - INTERVAL '7 days';

-- Partial indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_load_offers_pending 
ON public.load_offers (created_at DESC, rr_number) 
WHERE status = 'pending';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carrier_bids_recent 
ON public.carrier_bids (created_at DESC, bid_number) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Analyze tables after creating indexes
ANALYZE public.telegram_bids;
ANALYZE public.carrier_bids;
ANALYZE public.loads;
ANALYZE public.load_offers;
ANALYZE public.assignments;
ANALYZE public.carrier_profiles;
ANALYZE public.user_roles;

